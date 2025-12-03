import { Inject, Injectable } from '@nestjs/common';
import type { KeycloakEnvConfig } from '../../config/env';
import type { Request, Response } from 'express';
import { KeycloakTokenResponseDto } from '../dtos/keycloak-token-response.dto';
import type { UserSession } from '../../common/models/user-session.model';

@Injectable()
export class KeycloakService {
    constructor(@Inject('KEYCLOAK_CONFIG') private config: KeycloakEnvConfig) {}

    public login(req: Request, res: Response): void {
        // compute redirect URI from incoming request so it matches Keycloak client entry exactly
        const redirectUri =
            req.protocol && req.get('host')
                ? `${req.protocol}://${req.get('host')}/auth/callback`
                : this.config.keycloakCallbackURL;

        const params = new URLSearchParams({
            client_id: this.config.keycloakClientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
        });

        return res.redirect(
            `${this.config.keycloakHost}/auth?${params.toString()}`,
        );
    }

    public async callback(req: Request, res: Response): Promise<void> {
        // Safely extract code from query (string | ParsedQs | string[])
        const rawCode = req.query.code;
        const code = Array.isArray(rawCode)
            ? typeof rawCode[0] === 'string'
                ? rawCode[0]
                : undefined
            : typeof rawCode === 'string'
              ? rawCode
              : undefined;

        if (!code) {
            res.status(400).send('Missing or invalid code');
            return;
        }

        // compute redirect URI the same way as in login
        const redirectUri =
            req.protocol && req.get('host')
                ? `${req.protocol}://${req.get('host')}/auth/callback`
                : this.config.keycloakCallbackURL;

        // Échange du code contre un token (use URLSearchParams to build body safely)
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.keycloakClientId,
            client_secret: this.config.keycloakClientSecret,
            code,
            redirect_uri: redirectUri,
        });

        const tokenRes = await fetch(`${this.config.keycloakHost}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        let tokens: KeycloakTokenResponseDto | null = null;
        try {
            tokens = (await tokenRes.json()) as KeycloakTokenResponseDto;
        } catch (e) {
            console.error('Error parsing token response JSON:', e);
            const text = await tokenRes.text().catch(() => 'invalid json');
            res.status(502).send(`Token exchange invalid response: ${text}`);
            return;
        }

        // Debug: log what Keycloak returned (safe for dev only)
        console.debug('Keycloak token response:', tokens);
        const idPayload = this.tryDecodeJwtPayload(tokens?.id_token ?? null);
        if (idPayload) console.debug('Decoded id_token payload:', idPayload);

        // Validate presence of access_token (otherwise Keycloak denied)
        if (!tokens || !tokens.access_token) {
            res.status(502).send({
                message:
                    'Token exchange succeeded but no access_token returned',
                tokenResponse: tokens,
            });
            return;
        }

        // Store token payload in cookie-session (kept minimal)
        (req.session as UserSession).keycloakToken = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            id_token: tokens.id_token,
        };

        return res.redirect('/protected'); // Ton front ou route protégée
    }

    // --- LOGOUT ---
    logout(req: Request, res: Response): void {
        // read id_token from session (support both injected session or req.session)
        const idToken = (req.session as UserSession).keycloakToken?.id_token;

        // For cookie-session: clear the server-side session object
        (req.session as UserSession).keycloakToken = null;

        // Also clear the cookie on the client to ensure session removal
        try {
            res.clearCookie('novaflam.session', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });
        } catch {
            // ignore if clearCookie not available or fails
        }

        const baseUrl =
            req.protocol && req.get('host')
                ? `${req.protocol}://${req.get('host')}`
                : 'http://localhost:3000';

        const url =
            `${this.config.keycloakHost}/logout` +
            `?client_id=${this.config.keycloakClientId}` +
            `&id_token_hint=${encodeURIComponent(String(idToken))}` +
            `&post_logout_redirect_uri=${encodeURIComponent(baseUrl + '/')}`;

        return res.redirect(url);
    }

    // helper to decode JWT payloads (id_token) for debugging
    private tryDecodeJwtPayload(
        token?: string | null,
    ): Record<string, unknown> | null {
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length < 2) return null;
            const payloadStr = Buffer.from(
                parts[1].replace(/-/g, '+').replace(/_/g, '/'),
                'base64',
            ).toString('utf8');
            const parsed: unknown = JSON.parse(payloadStr);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed as Record<string, unknown>;
            }
            return null;
        } catch {
            return null;
        }
    }
}
