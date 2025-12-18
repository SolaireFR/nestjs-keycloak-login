import { Module, DynamicModule } from '@nestjs/common';
import { KeycloakService } from './services/keycloak.service';
import { loadAndValidateConfig } from '../config';

export const KEYCLOAK_CONFIG = 'KEYCLOAK_CONFIG';

@Module({})
export class KeycloakModule {
    static forRoot(): DynamicModule {
        const config = loadAndValidateConfig();

        return {
            module: KeycloakModule,
            providers: [
                KeycloakService,
                {
                    provide: KEYCLOAK_CONFIG,
                    useValue: config,
                },
            ],
            exports: [KeycloakService, KEYCLOAK_CONFIG],
        };
    }
}
