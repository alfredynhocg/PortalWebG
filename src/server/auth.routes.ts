import { Router, type Request, type Response, type NextFunction } from 'express';
import * as client from 'openid-client';
import { basePath, conBase, decodificarJwt, getOidcConfig, jwtVigente, oidcIdpHint, oidcScopes, requireEnv } from './oidc';

declare module 'express-session' {
  interface SessionData {
    oidcTxn?: {
      state: string;
      nonce: string;
      codeVerifier: string;
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

// Inicia el login: redirige a Keycloak, que ofrece Ciudadanía Digital.
authRouter.get('/auth/login', async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    req.session.oidcTxn = { state, nonce, codeVerifier, returnTo: returnToSeguro(req.query['returnTo']) };

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: requireEnv('OIDC_REDIRECT_URI'),
      scope: oidcScopes(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      // Siempre pedir credenciales: no reusar en silencio una sesión vieja de Keycloak.
      prompt: 'login',
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
      pkceCodeVerifier: txn.codeVerifier,
      expectedState: txn.state,
      expectedNonce: txn.nonce,
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
authRouter.get(['/callback', '/login'], callback);

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

// Callback configurado como "URL de redirección al cerrar sesión" en el proveedor.
authRouter.get('/logout', (_req, res) => {
  res.redirect(conBase('/'));
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
