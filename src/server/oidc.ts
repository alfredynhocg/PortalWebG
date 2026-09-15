import * as client from 'openid-client';

/**
 * Ciudadanía Digital emite el discovery document una sola vez y lo cachea;
 * si el issuer no responde al arrancar, cada request de auth vuelve a intentarlo.
 */
let configPromise: Promise<client.Configuration> | null = null;

export function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client
      .discovery(
        new URL(requireEnv('CD_ISSUER')),
        requireEnv('CD_CLIENT_ID'),
        requireEnv('CD_CLIENT_SECRET'),
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

export const CD_SCOPES =
  process.env['CD_SCOPES'] ?? 'openid profile fecha_nacimiento email celular offline_access';
