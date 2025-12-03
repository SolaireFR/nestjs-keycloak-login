import { KeycloakTokenResponseDto } from '../../keycloak/dtos/keycloak-token-response.dto';

export interface UserSession {
    keycloakToken?: KeycloakTokenResponseDto | null;
}
