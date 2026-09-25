import * as client from 'openid-client';

/**
 * Keycloak (realm `externo`, cliente `app-postulaciones`) intermedia el login
 * con Ciudadanía Digital. El discovery document se pide una sola vez y se
 * cachea; si el issuer no responde, cada request de auth vuelve a intentarlo.
 */
let configPromise: Promise<client.Configuration> | null = null;

export function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client
      .discovery(
        new URL(requireEnv('OIDC_ISSUER')),
        requireEnv('OIDC_CLIENT_ID'),
        requireEnv('OIDC_CLIENT_SECRET'),
      )
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

// Función y no constante: el .env se carga en server.ts DESPUÉS de evaluar los imports.
export function oidcScopes(): string {
  return process.env['OIDC_SCOPES'] ?? 'openid profile email';
}

// Lee los claims de un JWT SIN verificar la firma. Solo para uso interno del
// servidor: el token llegó directo del token endpoint por HTTPS. Quien sí debe
// verificar la firma es el backend (Laravel), que recibe el token por un header.
export function decodificarJwt(jwt: string): Record<string, unknown> {
  const payload = jwt.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
