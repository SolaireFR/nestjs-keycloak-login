import { Inject, Injectable } from '@nestjs/common';
import type { KeycloakEnvConfig } from '../../config/env';
import type { Request, Response } from 'express';
import { KeycloakTokenResponseDto } from '../dtos/keycloak-token-response.dto';
import type { UserSession } from '../../common/models/user-session.model';

@Injectable()
export class KeycloakService {
    constructor(@Inject('KEYCLOAK_CONFIG') private config: KeycloakEnvConfig) {}

    public login(req: Request, res: Response): void {
        const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;

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
            res.redirect(
                '/auth/error?code=400&message=Authorization code not provided',
            );
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
            console.debug('Error parsing token response JSON:', e);
            const text = await tokenRes.text().catch(() => 'invalid json');
            res.redirect(
                `/auth/error?code=502&message=Invalid token response: ${encodeURIComponent(
                    text,
                )}`,
            );
            return;
        }

        // Validate presence of access_token (otherwise Keycloak denied)
        if (!tokens || !tokens.access_token) {
            res.redirect(`/auth/error?code=502&message=Token exchange failed`);
            return;
        }

        // Store token payload in cookie-session (kept minimal)
        try {
            (req.session as UserSession).keycloakToken = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                id_token: tokens.id_token,
            };
        } catch (err) {
            console.debug('Error storing token in session:', err);
            return res.redirect(
                '/auth/error?code=500&message=Session storage failed',
            );
        }

        return res.redirect('/protected'); // Ton front ou route protégée
    }

    // --- LOGOUT ---
    async logout(req: Request, res: Response): Promise<void> {
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

        const url =
            `${this.config.keycloakHost}/logout` +
            `?client_id=${this.config.keycloakClientId}` +
            `&id_token_hint=${encodeURIComponent(String(idToken))}`;

        try {
            const logoutRes = await fetch(url, { method: 'GET' });
            if (logoutRes.ok) {
                res.status(200).send('Logged out successfully');
            } else {
                res.status(502).send('Logout failed at Keycloak');
            }
        } catch (err) {
            console.debug('Error during logout request to Keycloak:', err);
            res.status(502).send('Logout request to Keycloak failed');
        }
        return;
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
