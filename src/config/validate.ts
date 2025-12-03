import { KeycloakEnvConfig } from './env';

export function validateEnv(config: KeycloakEnvConfig): KeycloakEnvConfig {
    const errors: string[] = [];

    if (!config.keycloakHost) errors.push('KEYCLOAK_HOST est manquant.');

    if (!config.keycloakRealm) errors.push('KEYCLOAK_REALM est manquant.');

    if (!config.keycloakClientId)
        errors.push('KEYCLOAK_CLIENT_ID est manquant.');

    if (!config.keycloakClientSecret)
        errors.push('KEYCLOAK_CLIENT_SECRET est manquant.');

    if (!config.keycloakCallbackURL)
        errors.push('KEYCLOAK_CALLBACK_URL est manquant.');

    if (errors.length) {
        const msg = [
            '⚠️ Erreur de configuration dans ton package Keycloak :',
            ...errors.map((e) => ' - ' + e),
            "Corrige ton .env ou tes variables d'environnement.",
        ].join('\n');

        throw new Error(msg);
    }

    return config;
}
