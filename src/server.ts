import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import session from 'express-session';
import { join } from 'node:path';
import { authRouter } from './server/auth.routes';
import { cuentaRouter } from './server/cuenta.routes';
import { proxyPostulante } from './server/postulante.proxy';
import { basePath, conBase, requireEnv } from './server/oidc';

try {
  process.loadEnvFile();
} catch {
  // No .env presente (p. ej. en producción, donde las variables ya están en el entorno).
}

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine({ trustProxyHeaders: true });

app.set('trust proxy', 1);

app.use(
  session({
    name: 'portalweb.sid',
    secret: requireEnv('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  }),
);

// Todo bajo el prefijo público del portal: '' en local, '/portal' en el
// servidor (Apache reenvía /portal/* sin quitarlo). Ver BASE_PATH en .env.
const base = basePath();
app.use(base || '/', authRouter);
app.use(base || '/', cuentaRouter);
// Postular, wizard, documentos y "Mis postulaciones": van a Laravel con el token de la sesión.
app.use(`${base}/api/postulante`, proxyPostulante);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Las llamadas del frontend (/api/*) esperan JSON; las del flujo de login, una redirección.
  if (req.path.startsWith(conBase('/api/'))) {
    console.error('Error en', req.method, req.path, err);
    res.status(502).json({ error: { message: 'No se pudo contactar al servidor. Intenta nuevamente.', code: 502 } });
    return;
  }
  console.error('Error de autenticación:', err);
  res.redirect(conBase('/?authError=1'));
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
