import express, { Router, type Request, type Response } from 'express';
import { requireEnv } from './oidc';
import { obtenerAccessToken } from './token';

/**
 * Perfil del usuario logueado. El navegador nunca ve el access_token: llama a
 * /api/cuenta/* con su cookie de sesión y este servidor reenvía a Laravel
 * (/api/portal/me) agregando el token de Keycloak.
 */
export const cuentaRouter = Router();

async function reenviarAPerfil(req: Request, res: Response, metodo: 'GET' | 'PUT') {
  const token = await obtenerAccessToken(req);
  if (!token) {
    res.status(401).json({ error: { message: 'Tu sesión expiró. Inicia sesión nuevamente.', code: 401 } });
    return;
  }

  const respuesta = await fetch(`${requireEnv('API_BACKEND_URL')}/api/portal/me`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(metodo === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: metodo === 'PUT' ? JSON.stringify(req.body ?? {}) : undefined,
  });
  const cuerpo = await respuesta.json().catch(() => null);

  // Mantiene al día el resumen de la sesión (nombre, registro_completo), que
  // es lo que consultan el encabezado y los guards.
  if (respuesta.ok && cuerpo?.data) {
    const { perfil: _perfil, ...resumen } = cuerpo.data;
    req.session.backend = resumen;
  }

  res.status(respuesta.status).json(cuerpo ?? { error: { message: 'Respuesta inválida del servidor.', code: 502 } });
}

cuentaRouter.get('/api/cuenta/perfil', (req, res, next) => {
  reenviarAPerfil(req, res, 'GET').catch(next);
});

cuentaRouter.put('/api/cuenta/perfil', express.json({ limit: '50kb' }), (req, res, next) => {
  reenviarAPerfil(req, res, 'PUT').catch(next);
});
