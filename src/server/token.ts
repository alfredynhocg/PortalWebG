import type { Request } from 'express';
import * as client from 'openid-client';
import { getOidcConfig } from './oidc';

// Margen para no mandar a Laravel un token que expire en pleno viaje.
const MARGEN_MS = 30_000;

// Un refresh en curso por sesión: si llegan dos requests a la vez con el token
// vencido, ambos esperan el mismo refresh en vez de gastar el refresh_token dos veces.
const refrescosEnCurso = new Map<string, Promise<string | null>>();

/**
 * access_token vigente de la sesión (lo renueva con el refresh_token si hace
 * falta). null = no hay sesión o ya no se puede renovar: hay que volver a
 * iniciar sesión.
 */
export async function obtenerAccessToken(req: Request): Promise<string | null> {
  const tokens = req.session.tokens;
  if (!tokens) {
    return null;
  }
  if (tokens.expiresAt - MARGEN_MS > Date.now()) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    return null;
  }

  let refresco = refrescosEnCurso.get(req.sessionID);
  if (!refresco) {
    refresco = refrescar(req, tokens.refreshToken).finally(() => refrescosEnCurso.delete(req.sessionID));
    refrescosEnCurso.set(req.sessionID, refresco);
  }
  return refresco;
}

async function refrescar(req: Request, refreshToken: string): Promise<string | null> {
  try {
    const config = await getOidcConfig();
    const nuevos = await client.refreshTokenGrant(config, refreshToken);
    req.session.tokens = {
      accessToken: nuevos.access_token,
      // Keycloak rota el refresh_token; si no manda uno nuevo, sigue valiendo el anterior.
      refreshToken: nuevos.refresh_token ?? refreshToken,
      idToken: nuevos.id_token ?? req.session.tokens?.idToken,
      expiresAt: Date.now() + (nuevos.expires_in ?? 300) * 1000,
    };
    return nuevos.access_token;
  } catch (err) {
    // refresh_token vencido (30 min) o sesión cerrada en Keycloak.
    console.warn('[Keycloak] no se pudo renovar el token:', (err as Error).message);
    delete req.session.tokens;
    delete req.session.user;
    delete req.session.backend;
    return null;
  }
}
