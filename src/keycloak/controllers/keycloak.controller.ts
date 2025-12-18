import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { KeycloakService } from '../services/keycloak.service';

@Controller('auth')
export class AuthController {
    constructor(
        @Inject(KeycloakService) private keycloakService: KeycloakService,
    ) {}

    // --- LOGIN ---
    @Public()
    @Get('login')
    login(
        @Req() req: Request,
        @Res({ passthrough: false }) res: Response,
    ): void {
        return this.keycloakService.login(req, res);
    }

    // --- CALLBACK ---
    @Public()
    @Get('callback')
    async callback(
        @Req() req: Request,
        @Res({ passthrough: false }) res: Response,
    ): Promise<void> {
        return this.keycloakService.callback(req, res);
    }

    // --- LOGOUT ---
    @Public()
    @Get('logout')
    async logout(
        @Req() req: Request,
        @Res({ passthrough: false }) res: Response,
    ): Promise<void> {
        return this.keycloakService.logout(req, res);
    }

    // --- ERROR ---
    @Public()
    @Get('error')
    error(
        @Res({ passthrough: false }) res: Response,
        @Req() req: Request,
    ): void {
        const { code = 500, message = 'Authentication error occurred' } =
            req.query;
        res.status(Number(code)).send({
            message,
        });
    }
}
