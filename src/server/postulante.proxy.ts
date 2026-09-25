import type { Request, Response, NextFunction } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { requireEnv } from './oidc';
import { obtenerAccessToken } from './token';

// Cabeceras que se copian en cada sentido. El resto (cookies, Authorization
// del navegador, hop-by-hop) no se reenvía.
const CABECERAS_PETICION = ['content-type', 'content-length', 'accept'];
const CABECERAS_RESPUESTA = ['content-type', 'content-length', 'content-disposition', 'cache-control'];

/**
 * /api/postulante/* → Laravel /api/portal/* con el access_token de la sesión.
 * El navegador nunca ve el token. El cuerpo va y vuelve en streaming, así
 * funcionan también la subida de archivos (multipart) y la descarga de
 * documentos (PDF/imagen).
 */
export async function proxyPostulante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = await obtenerAccessToken(req);
    if (!token) {
      res.status(401).json({ error: { message: 'Tu sesión expiró. Inicia sesión nuevamente.', code: 401 } });
      return;
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    for (const nombre of CABECERAS_PETICION) {
      const valor = req.headers[nombre];
      if (typeof valor === 'string') {
        headers[nombre] = valor;
      }
    }

    const tieneCuerpo = !['GET', 'HEAD'].includes(req.method);
    // req.url ya viene sin el prefijo /api/postulante (lo quita app.use).
    const respuesta = await fetch(`${requireEnv('API_BACKEND_URL')}/api/portal${req.url}`, {
      method: req.method,
      headers,
      body: tieneCuerpo ? (Readable.toWeb(req) as unknown as BodyInit) : undefined,
      // Necesario en Node para mandar un cuerpo en streaming.
      ...(tieneCuerpo ? { duplex: 'half' } : {}),
    } as RequestInit);

    res.status(respuesta.status);
    for (const nombre of CABECERAS_RESPUESTA) {
      const valor = respuesta.headers.get(nombre);
      if (valor) {
        res.setHeader(nombre, valor);
      }
    }
    if (!respuesta.body) {
      res.end();
      return;
    }
    Readable.fromWeb(respuesta.body as unknown as WebReadableStream).pipe(res);
  } catch (err) {
    next(err);
  }
}
