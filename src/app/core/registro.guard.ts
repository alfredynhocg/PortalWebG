import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Va DESPUÉS de authGuard: con sesión pero sin registro completo, manda a
// /registro (al guardar, el registro lleva al listado de convocatorias).
export const registroGuard: CanActivateFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.sesionLista();
  if (auth.registroCompleto()) {
    return true;
  }
  return router.createUrlTree(['/registro']);
};
