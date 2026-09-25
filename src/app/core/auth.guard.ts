import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

// Rutas que requieren sesión: sin sesión, manda a iniciar sesión con
// Ciudadanía Digital y vuelve a la misma ruta. En el servidor (SSR) no hay
// cookie de sesión que consultar; estas rutas se renderizan solo en el
// navegador (ver app.routes.server.ts), así que ahí se deja pasar.
export const authGuard: CanActivateFn = async (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }
  const auth = inject(AuthService);
  await auth.sesionLista();
  if (auth.session().authenticated) {
    return true;
  }
  auth.login(state.url);
  return false;
};
