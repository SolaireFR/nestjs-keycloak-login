import * as dotenv from 'dotenv';
dotenv.config();

export interface KeycloakEnvConfig {
    keycloakHost: string;
    keycloakRealm: string;
    keycloakClientId: string;
    keycloakClientSecret: string;
    keycloakCallbackURL: string;
}

export function loadEnv(): KeycloakEnvConfig {
    return {
        keycloakHost: process.env.KEYCLOAK_HOST || '',
        keycloakRealm: process.env.KEYCLOAK_REALM || '',
        keycloakClientId: process.env.KEYCLOAK_CLIENT_ID || '',
        keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
        keycloakCallbackURL: process.env.KEYCLOAK_CALLBACK_URL || '',
    };
}
