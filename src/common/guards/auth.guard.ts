import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { KeycloakService } from '../../keycloak/services/keycloak.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly keycloakService: KeycloakService,
    ) {}
    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const authHeader = request.headers?.authorization;

        try {
            // Define session shape locally to read token
            interface TokenResponse {
                access_token?: string | null;
                refresh_token?: string | null;
                id_token?: string | null;
                [key: string]: any;
            }
            interface MySession {
                keycloak?: TokenResponse | null;
            }

            // Try to read token from session first (access_token or id_token)
            const session = (request as Request & { session?: MySession })
                .session;
            const sessionToken =
                session?.keycloak?.access_token ??
                session?.keycloak?.id_token ??
                null;

            // Determine the header to use for validation.
            let headerToValidate: string | null = null;
            if (authHeader) {
                headerToValidate = authHeader;
            } else if (sessionToken) {
                headerToValidate = `Bearer ${sessionToken}`;
            }

            if (!headerToValidate) {
                throw new HttpException(
                    'Unauthorized',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // decode token payload to extract user id and attach to request
            const token = headerToValidate.startsWith('Bearer ')
                ? headerToValidate.slice(7)
                : headerToValidate;

            if (token) {
                try {
                    const parts = token.split('.');
                    if (parts.length >= 2) {
                        const payloadB64 = parts[1]
                            .replace(/-/g, '+')
                            .replace(/_/g, '/');
                        const pad = payloadB64.length % 4;
                        const padded = pad
                            ? payloadB64 + '='.repeat(4 - pad)
                            : payloadB64;
                        const json = Buffer.from(padded, 'base64').toString(
                            'utf8',
                        );
                        const payload = JSON.parse(json) as unknown;
                        // ensure payload is an object before accessing properties
                        const isRecord = (
                            v: unknown,
                        ): v is Record<string, unknown> =>
                            typeof v === 'object' && v !== null;
                        let id: string | number | null = null;
                        if (isRecord(payload)) {
                            const sub = payload['sub'];
                            const userId = payload['user_id'];
                            if (
                                typeof sub === 'string' ||
                                typeof sub === 'number'
                            ) {
                                id = sub;
                            } else if (
                                typeof userId === 'string' ||
                                typeof userId === 'number'
                            ) {
                                id = userId;
                            }
                            if (id != null) {
                                // attach to request for controllers and decorators (e.g. CurrentUserId)
                                const reqWithUser = request as Request & {
                                    user?: { id?: string | number };
                                };
                                reqWithUser.user = { id };
                            }
                        }
                    }
                } catch {
                    // ignore decode errors;
                    throw new HttpException(
                        'Unauthorized',
                        HttpStatus.UNAUTHORIZED,
                    );
                }
            }

            return true;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
    }
}
