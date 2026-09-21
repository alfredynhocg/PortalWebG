import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from './errores';

export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024; // 5 MB, igual que el API

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'webp'];

export const ACEPTAR_IMAGEN = 'image/jpeg,image/png,image/webp';
export const ACEPTAR_DOCUMENTO = 'application/pdf,' + ACEPTAR_IMAGEN;

export function validarArchivo(archivo: File, soloImagen: boolean): string | null {
  if (archivo.size === 0) {
    return 'El archivo está vacío.';
  }
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    return `El archivo no puede superar los ${TAMANO_MAXIMO_ARCHIVO / 1024 / 1024} MB.`;
  }

  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const esImagen = TIPOS_IMAGEN.includes(archivo.type) || EXTENSIONES_IMAGEN.includes(extension);
  const esPdf = archivo.type === 'application/pdf' || extension === 'pdf';

  if (soloImagen && !esImagen) {
    return 'La fotografía debe ser una imagen JPG, PNG o WEBP.';
  }
  if (!soloImagen && !esImagen && !esPdf) {
    return 'El archivo debe ser un PDF o una imagen JPG, PNG o WEBP.';
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
