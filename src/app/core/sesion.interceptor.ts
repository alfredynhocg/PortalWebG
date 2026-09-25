import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Respuestas de las llamadas del postulante (/api/postulante, /api/cuenta):
//  401 → la sesión de Ciudadanía Digital venció: volver a iniciar sesión.
//  403 registro_incompleto → completar el registro.
// El error sigue su curso para que la pantalla deje de mostrar "cargando".
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!/^\/?api\/(postulante|cuenta)\//.test(req.url)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.login(router.url);
      } else if (err.status === 403 && err.error?.error?.motivo === 'registro_incompleto') {
        void router.navigate(['/registro']);
      }
      return throwError(() => err);
    }),
  );
};
