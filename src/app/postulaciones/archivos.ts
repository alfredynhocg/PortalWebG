import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from './errores';
import { TipoArchivo } from './postulacion.model';

// Límites por tipo de documento (págs. 43-53 del requerimiento) — mismos que
// PostulanteController::LIMITES_ARCHIVO. Antes había un único límite (5 MB,
// PDF o imagen) para todo; la foto es la única que acepta imagen (sin WEBP,
// el PDF del requerimiento solo menciona .jpg/.jpeg/.png).
interface LimiteArchivo {
  mb: number;
  mimes: string[];
  extensiones: string[];
  aceptar: string; // para el atributo [accept] del <input type="file">
}

const LIMITES_ARCHIVO: Record<TipoArchivo, LimiteArchivo> = {
  foto_perfil: { mb: 2, mimes: ['image/jpeg', 'image/png'], extensiones: ['jpg', 'jpeg', 'png'], aceptar: 'image/jpeg,image/png' },
  cedula: { mb: 3, mimes: ['application/pdf'], extensiones: ['pdf'], aceptar: 'application/pdf' },
  libreta: { mb: 3, mimes: ['application/pdf'], extensiones: ['pdf'], aceptar: 'application/pdf' },
  formacion: { mb: 5, mimes: ['application/pdf'], extensiones: ['pdf'], aceptar: 'application/pdf' },
  experiencia: { mb: 5, mimes: ['application/pdf'], extensiones: ['pdf'], aceptar: 'application/pdf' },
  conocimiento: { mb: 5, mimes: ['application/pdf'], extensiones: ['pdf'], aceptar: 'application/pdf' },
};

export function aceptarPara(tipo: TipoArchivo): string {
  return LIMITES_ARCHIVO[tipo].aceptar;
}

export function esImagen(tipo: TipoArchivo): boolean {
  return tipo === 'foto_perfil';
}

export function validarArchivo(archivo: File, tipo: TipoArchivo): string | null {
  const limite = LIMITES_ARCHIVO[tipo];
  if (archivo.size === 0) {
    return 'El archivo está vacío.';
  }
  const maximoBytes = limite.mb * 1024 * 1024;
  if (archivo.size > maximoBytes) {
    return `El archivo no puede superar los ${limite.mb} MB.`;
  }

  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const tipoValido = limite.mimes.includes(archivo.type) || limite.extensiones.includes(extension);
  if (!tipoValido) {
    return esImagen(tipo) ? 'La fotografía debe ser una imagen JPG o PNG.' : 'El archivo debe ser un PDF.';
  }
  return null;
}

export function formatoTamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const MENSAJE_ARCHIVO_ILEGIBLE =
  'El archivo está dañado o no se puede leer. Vuelve a generarlo y súbelo nuevamente.';

export async function verificarLectura(archivo: File): Promise<string | null> {
  try {
    const esPdf = archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');
    if (esPdf) {
      const cabecera = await archivo.slice(0, 5).text();
      return cabecera === '%PDF-' ? null : MENSAJE_ARCHIVO_ILEGIBLE;
    }
    if (typeof createImageBitmap === 'function') {
      const imagen = await createImageBitmap(archivo);
      imagen.close();
    }
    return null;
  } catch {
    return MENSAJE_ARCHIVO_ILEGIBLE;
  }
}

export function mensajeErrorArchivo(err: HttpErrorResponse): string {
  const detalle = err.error?.error?.errors?.archivo;
  if (Array.isArray(detalle) && detalle.length > 0) {
    return detalle.join(' ');
  }
  return mensajeError(err, 'No se pudo subir el archivo.');
}
