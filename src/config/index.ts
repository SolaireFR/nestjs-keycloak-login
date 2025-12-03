import { loadEnv } from './env';
import { validateEnv } from './validate';

export function loadAndValidateConfig() {
    const env = loadEnv();
    return validateEnv(env);
}
