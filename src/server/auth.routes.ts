import { Router } from 'express';
import * as client from 'openid-client';
import { CD_SCOPES, getOidcConfig, requireEnv } from './oidc';

declare module 'express-session' {
  interface SessionData {
    oidcTxn?: {
      state: string;
      nonce: string;
      codeVerifier: string;
      returnTo: string;
    };
    user?: Record<string, unknown>;
    idToken?: string;
  }
}

export const authRouter = Router();

// Inicia el login: redirige a Ciudadanía Digital.
authRouter.get('/auth/login', async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();
    const returnTo = typeof req.query['returnTo'] === 'string' ? req.query['returnTo'] : '/';

    req.session.oidcTxn = { state, nonce, codeVerifier, returnTo };

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: requireEnv('CD_REDIRECT_URI'),
      scope: CD_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    res.redirect(authorizationUrl.href);
  } catch (err) {
    next(err);
  }
});

// Callback configurado como "URL de redirección" en el proveedor.
authRouter.get('/login', async (req, res, next) => {
  const txn = req.session.oidcTxn;
  try {
    if (!txn) {
      throw new Error('No hay un inicio de sesión en curso (sesión expirada o inválida).');
    }

    const config = await getOidcConfig();
    const currentUrl = new URL(req.originalUrl, requireEnv('CD_REDIRECT_URI'));

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: txn.codeVerifier,
      expectedState: txn.state,
      expectedNonce: txn.nonce,
    });

    req.session.user = tokens.claims();
    req.session.idToken = tokens.id_token;
    delete req.session.oidcTxn;

    res.redirect(txn.returnTo || '/');
  } catch (err) {
    delete req.session.oidcTxn;
    next(err);
  }
});

// Inicia el logout: cierra la sesión local y termina la sesión en Ciudadanía Digital.
authRouter.get('/auth/logout', async (req, res, next) => {
  try {
    const config = await getOidcConfig();
    const idToken = req.session.idToken;

    const endSessionUrl = idToken
      ? client.buildEndSessionUrl(config, {
          id_token_hint: idToken,
          post_logout_redirect_uri: requireEnv('CD_POST_LOGOUT_REDIRECT_URI'),
        }).href
      : '/';

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
  res.redirect('/');
});

// Consultado por el frontend para saber si hay una sesión activa.
authRouter.get('/api/auth/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});
