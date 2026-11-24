import express, { Router, type Request, type Response, type NextFunction } from 'express';
import * as client from 'openid-client';
import { basePath, conBase, decodificarJwt, getOidcConfig, jwtVigente, oidcIdpHint, oidcScopes, requireEnv } from './oidc';
import { obtenerAccessToken } from './token';

declare module 'express-session' {
  interface SessionData {
    oidcTxn?: {
      state: string;
      returnTo: string;
    };
    user?: Record<string, unknown>;
    tokens?: {
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresAt: number; // epoch en ms
    };
    backend?: Record<string, unknown>; // lo que respondió Laravel en POST /api/portal/sesion
  }
}

// Se monta bajo el prefijo del portal (ver basePath() y server.ts): las rutas
// de acá son relativas a él y las redirecciones internas pasan por conBase().
export const authRouter = Router();

// returnTo es una ruta de la app ('/convocatorias/detalle?...'), sin el prefijo.
// Solo rutas internas: evita que ?returnTo=https://otro-sitio convierta el login
// en un open redirect. Si llega con el prefijo (/portal/...), se le quita.
function returnToSeguro(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')) {
    return '/';
  }
  const base = basePath();
  if (base && (valor === base || valor.startsWith(`${base}/`))) {
    return valor.slice(base.length) || '/';
  }
  return valor;
}

// Rutas equivalentes al ejemplo de referencia (~/Downloads/ciudadania/server.js):
//   /login           → redirige a Keycloak (y con kc_idp_hint, directo a Ciudadanía)
//   /callback        → intercambia el code por los tokens
//   /userinfo        → GET directo al userinfo de Keycloak (refresca el token si hace falta)
//   /logout          → logout backchannel (POST directo a Keycloak con el refresh_token)
//   /logout-browser  → logout por navegador (end_session de Keycloak)
// /auth/login y /auth/logout son los que usa el frontend (AuthService).

// Inicia el login: redirige a Keycloak, que ofrece Ciudadanía Digital.
authRouter.get(['/login', '/auth/login'], async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    // state: protege el callback contra CSRF (Keycloak lo devuelve tal cual).
    const state = client.randomState();

    req.session.oidcTxn = { state, returnTo: returnToSeguro(req.query['returnTo']) };

    // URL mínima: client_id, redirect_uri, response_type=code, scope (+ state).
    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: requireEnv('OIDC_REDIRECT_URI'),
      scope: oidcScopes(),
      state,
      ...(oidcIdpHint() ? { kc_idp_hint: oidcIdpHint()! } : {}),
    });

    res.redirect(authorizationUrl.href);
  } catch (err) {
    next(err);
  }
});

// Registra/actualiza al usuario en Laravel con el access_token recién obtenido.
// Laravel verifica la firma, usa el CI del token como llave y responde
// { ci, complemento, nombre, registro_completo }.
async function registrarEnBackend(accessToken: string): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${requireEnv('API_BACKEND_URL')}/api/portal/sesion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(`Laravel respondió ${respuesta.status}: ${JSON.stringify(cuerpo)}`);
  }
  return cuerpo.data;
}

// Callback: la "Valid redirect URI" registrada en Keycloak (OIDC_REDIRECT_URI,
// p. ej. http://localhost:3000/callback o https://<host>/portal/callback).
async function callback(req: Request, res: Response, next: NextFunction) {
  const txn = req.session.oidcTxn;
  try {
    if (!txn) {
      throw new Error('No hay un inicio de sesión en curso (sesión expirada o inválida).');
    }

    const config = await getOidcConfig();
    const currentUrl = new URL(req.originalUrl, requireEnv('OIDC_REDIRECT_URI'));

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      expectedState: txn.state,
    });

    // TEMPORAL (paso 1 de la guía): ver qué claims trae el access_token para
    // saber cómo se llama el CI. Quitar una vez confirmado: son datos personales.
    if (process.env['NODE_ENV'] !== 'production') {
      console.log('[Keycloak] claims del access_token:', JSON.stringify(decodificarJwt(tokens.access_token), null, 2));
    }

    // Si Laravel rechaza el token, esto lanza y el usuario vuelve a /?authError=1
    // sin quedar "logueado a medias" (sesión en el portal pero no en el backend).
    const backend = await registrarEnBackend(tokens.access_token);

    req.session.user = tokens.claims();
    req.session.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 300) * 1000,
    };
    req.session.backend = backend;
    delete req.session.oidcTxn;

    // Primer ingreso (o registro a medias): completar datos antes de seguir;
    // al guardar, /registro lleva al listado de convocatorias.
    // /api/* se deja pasar para poder depurar con /api/auth/debug.
    if (backend['registro_completo'] !== true && !txn.returnTo.startsWith('/api/')) {
      res.redirect(conBase('/registro'));
      return;
    }
    res.redirect(conBase(txn.returnTo));
  } catch (err) {
    delete req.session.oidcTxn;
    next(err);
  }
}
authRouter.get('/callback', callback);

// Login con usuario y contraseña (grant_type=password), sin salir del portal:
// el mismo POST a /token que se prueba en Postman, pero hecho desde el
// servidor para que el client_secret nunca llegue al navegador.
// Body: { username, password, returnTo? } → { redirectTo } (ruta de la app).
authRouter.post('/auth/password', express.json({ limit: '10kb' }), async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      res.status(400).json({ error: { message: 'Ingresa tu usuario y contraseña.', code: 400 } });
      return;
    }

    const config = await getOidcConfig();
    const respuesta = await fetch(config.serverMetadata().token_endpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: requireEnv('OIDC_CLIENT_ID'),
        client_secret: requireEnv('OIDC_CLIENT_SECRET'),
        username: username.trim(),
        password,
        scope: oidcScopes(),
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !datos.access_token) {
      // invalid_grant = usuario o contraseña incorrectos (o cuenta deshabilitada).
      const credencialesInvalidas = datos.error === 'invalid_grant';
      console.warn(`[Keycloak] login con contraseña respondió ${respuesta.status}: ${datos.error ?? ''} ${datos.error_description ?? ''}`);
      res.status(credencialesInvalidas ? 401 : 502).json({
        error: {
          message: credencialesInvalidas ? 'Usuario o contraseña incorrectos.' : 'No se pudo iniciar sesión. Intenta nuevamente.',
          code: credencialesInvalidas ? 401 : 502,
        },
      });
      return;
    }

    // Mismo registro en Laravel que el callback: si lo rechaza, no hay sesión a medias.
    const backend = await registrarEnBackend(datos.access_token);
    const returnTo = returnToSeguro(req.body?.returnTo);

    // Sesión nueva tras autenticarse (evita fijación de sesión).
    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.user = decodificarJwt(datos.id_token ?? datos.access_token);
      req.session.tokens = {
        accessToken: datos.access_token,
        refreshToken: datos.refresh_token,
        idToken: datos.id_token,
        expiresAt: Date.now() + (datos.expires_in ?? 300) * 1000,
      };
      req.session.backend = backend;
      res.json({ redirectTo: backend['registro_completo'] !== true ? '/registro' : returnTo });
    });
  } catch (err) {
    console.error('[Keycloak] error en login con contraseña:', err);
    res.status(502).json({ error: { message: 'No se pudo iniciar sesión. Intenta nuevamente.', code: 502 } });
  }
});

// Logout backchannel: POST directo a Keycloak con el refresh_token. Invalida la
// sesión en el servidor de Keycloak aunque el id_token ya haya vencido.
// Keycloak responde 204 si la cerró; cualquier otra cosa se registra y se sigue.
async function logoutBackchannel(config: client.Configuration, refreshToken: string): Promise<void> {
  const endpoint = config.serverMetadata().end_session_endpoint;
  if (!endpoint) {
    return;
  }
  try {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: requireEnv('OIDC_CLIENT_ID'),
        client_secret: requireEnv('OIDC_CLIENT_SECRET'),
        refresh_token: refreshToken,
      }),
    });
    if (respuesta.status !== 204) {
      console.warn(`[Keycloak] logout backchannel respondió ${respuesta.status}: ${await respuesta.text()}`);
    }
  } catch (err) {
    console.warn('[Keycloak] falló el logout backchannel:', (err as Error).message);
  }
}

// Inicia el logout: cierra la sesión en Keycloak (backchannel), destruye la
// sesión local y, si el id_token sigue vigente, pasa el navegador por el
// end_session de Keycloak para borrar también su cookie (sin pantalla de
// confirmación). Con el id_token vencido Keycloak pediría confirmar, así que
// se vuelve directo al inicio: la sesión ya quedó cerrada por backchannel.
authRouter.get('/auth/logout', async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    const idToken = req.session.tokens?.idToken;
    const refreshToken = req.session.tokens?.refreshToken;

    if (refreshToken) {
      await logoutBackchannel(config, refreshToken);
    }

    const endSessionUrl = idToken && jwtVigente(idToken)
      ? client.buildEndSessionUrl(config, {
          id_token_hint: idToken,
          post_logout_redirect_uri: requireEnv('OIDC_POST_LOGOUT_REDIRECT_URI'),
        }).href
      : conBase('/');

    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(endSessionUrl);
    });
  } catch (err) {
    next(err);
  }
});

// Logout BACKCHANNEL (como /logout del ejemplo): cierra la sesión en el servidor
// de Keycloak y la local. No borra la cookie de Keycloak en el navegador.
authRouter.get('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.session.tokens?.refreshToken;
    if (refreshToken) {
      await logoutBackchannel(await getOidcConfig(), refreshToken);
    }
    req.session.destroy((err) => (err ? next(err) : res.redirect(conBase('/'))));
  } catch (err) {
    next(err);
  }
});

// Logout por NAVEGADOR (como /logout-browser del ejemplo): pasa por el
// end_session de Keycloak, que sí borra su cookie. Con el id_token vigente va
// id_token_hint (sin confirmación); si no, client_id.
authRouter.get('/logout-browser', async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    const idToken = req.session.tokens?.idToken;
    const parametros: Record<string, string> = {
      post_logout_redirect_uri: requireEnv('OIDC_POST_LOGOUT_REDIRECT_URI'),
    };
    if (idToken && jwtVigente(idToken)) {
      parametros['id_token_hint'] = idToken;
    } else {
      parametros['client_id'] = requireEnv('OIDC_CLIENT_ID');
    }
    const url = client.buildEndSessionUrl(config, parametros).href;
    req.session.destroy((err) => (err ? next(err) : res.redirect(url)));
  } catch (err) {
    next(err);
  }
});

// UserInfo (como /userinfo del ejemplo): GET directo a Keycloak con el
// access_token de la sesión, renovado antes si está por expirar.
authRouter.get('/userinfo', async (req, res, next) => {
  try {
    const accessToken = await obtenerAccessToken(req);
    if (!accessToken) {
      res.status(401).json({ error: { message: 'No hay sesión. Inicia sesión primero.', code: 401 } });
      return;
    }
    const endpoint = (await getOidcConfig()).serverMetadata().userinfo_endpoint;
    const respuesta = await fetch(endpoint!, { headers: { Authorization: `Bearer ${accessToken}` } });
    const datos = await respuesta.json().catch(() => ({}));
    res.status(respuesta.status).json({
      status: respuesta.status,
      message: respuesta.ok ? 'UserInfo obtenido' : 'Fallo al obtener userinfo',
      response: datos,
    });
  } catch (err) {
    next(err);
  }
});

// SOLO DESARROLLO: muestra lo que llegó de Keycloak en el último login (claims
// de ambos tokens y el access_token crudo para probarlo contra Laravel con curl).
// En producción responde 404.
authRouter.get('/api/auth/debug', (req, res) => {
  if (process.env['NODE_ENV'] === 'production') {
    res.status(404).end();
    return;
  }
  const tokens = req.session.tokens;
  if (!tokens) {
    res.json({ authenticated: false, ayuda: 'Inicia sesión en /auth/login y vuelve a esta página.' });
    return;
  }
  const segundosRestantes = Math.round((tokens.expiresAt - Date.now()) / 1000);
  res.json({
    access_token_expira_en_segundos: segundosRestantes,
    access_token_claims: decodificarJwt(tokens.accessToken),
    id_token_claims: tokens.idToken ? decodificarJwt(tokens.idToken) : null,
    backend: req.session.backend ?? null,
    access_token: tokens.accessToken,
  });
});

// Consultado por el frontend para saber si hay una sesión activa. Nunca devuelve tokens.
authRouter.get('/api/auth/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user, backend: req.session.backend });
  } else {
    res.json({ authenticated: false });
  }
});
