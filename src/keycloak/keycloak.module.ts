import { Module, DynamicModule } from '@nestjs/common';
import { KeycloakService } from './services/keycloak.service';
import { loadAndValidateConfig } from '../config';

@Module({})
export class KeycloakModule {
    static forRoot(): DynamicModule {
        const config = loadAndValidateConfig();

        return {
            module: KeycloakModule,
            providers: [
                KeycloakService,
                { provide: 'KEYCLOAK_CONFIG', useValue: config },
            ],
            exports: [KeycloakService],
        };
    }
}
