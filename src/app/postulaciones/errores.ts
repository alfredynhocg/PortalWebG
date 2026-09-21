import { HttpErrorResponse } from '@angular/common/http';

// Mensaje a mostrar para un error del API del portal.
//   { error: { message, code } }                  -> message
//   422 { error: { message, code, errors: {...} } } -> message + detalle por campo
// Códigos con significado propio en el flujo de postulación:
//   404 convocatoria/postulación inexistente, 409 duplicado (CI ya postuló o
//   bloque ya agregado), 422 datos inválidos / plazo vencido / ya enviada.
export function mensajeError(err: HttpErrorResponse, porDefecto: string): string {
  if (err.status === 0) {
    return 'No hay conexión con el servidor. Intenta nuevamente.';
  }

  const cuerpo = err.error?.error;
  const mensaje: string = cuerpo?.message ?? porDefecto;
  const errores = cuerpo?.errors as Record<string, string[]> | undefined;

  if (errores && typeof errores === 'object') {
    const detalle = Object.values(errores).flat().join(' ');
    if (detalle) {
      return `${mensaje} ${detalle}`;
    }
  }

  return mensaje;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
