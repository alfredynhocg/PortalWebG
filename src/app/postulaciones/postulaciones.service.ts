import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DEMO_CONFIG } from '../demo-config';
import {
  ArchivoSubidoResponse,
  BloqueResponse,
  ChecklistDocumentosResponse,
  Conocimiento,
  ConocimientoInput,
  DatosPersonalesPostulante,
  DireccionOrden,
  Experiencia,
  ExperienciaInput,
  Formacion,
  FormacionInput,
  MisPostulacionesResponse,
  Postulacion,
  PostulacionResponse,
  PostulacionResumenResponse,
  QuitarPostulacionResponse,
  TipoArchivo,
} from './postulacion.model';

@Injectable({ providedIn: 'root' })
export class PostulacionesService {
  private readonly platformId = inject(PLATFORM_ID);

  constructor(private http: HttpClient) {}

  // El código de acceso (UUID) del paso 1 es la única forma de volver a una
  // postulación: "Mis postulaciones" no lo devuelve y un 409 tampoco. Se guarda
  // en el navegador por convocatoria + persona (CI + complemento).
  private claveAcceso(codigo: string, ci: string, complemento?: string): string {
    return `portal:postulacion:${codigo}:${ci.trim()}:${(complemento ?? '').trim().toUpperCase()}`;
  }

  guardarAcceso(codigo: string, ci: string, complemento: string | undefined, id: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      localStorage.setItem(this.claveAcceso(codigo, ci, complemento), id);
    } catch {
      // almacenamiento no disponible (modo privado, cuota): el flujo sigue sin él
    }
  }

  obtenerAcceso(codigo: string, ci: string, complemento?: string): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    try {
      return localStorage.getItem(this.claveAcceso(codigo, ci, complemento));
    } catch {
      return null;
    }
  }

  olvidarAcceso(codigo: string, ci: string, complemento?: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      localStorage.removeItem(this.claveAcceso(codigo, ci, complemento));
    } catch {
      // ídem guardarAcceso
    }
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${DEMO_CONFIG.demoToken}`,
      Accept: 'application/json',
    });
  }

  // Paso 1 — PostulanteController::postular().
  postular(codigo: string, datos: DatosPersonalesPostulante): Observable<PostulacionResponse> {
    return this.http.post<PostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/convocatorias/${codigo}/postulaciones`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 1 (edición) — PostulanteController::actualizarDatos(). A diferencia
  // de postular(), esto actualiza una postulación ya creada; solo funciona
  // mientras esté en ELABORADO (422 si ya fue enviada).
  actualizarDatos(postulacionId: string, datos: DatosPersonalesPostulante): Observable<PostulacionResumenResponse> {
    return this.http.put<PostulacionResumenResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/datos`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 2 — PostulanteController::agregarFormacion().
  agregarFormacion(postulacionId: string, datos: FormacionInput): Observable<BloqueResponse<Formacion>> {
    return this.http.post<BloqueResponse<Formacion>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/formaciones`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 3 — PostulanteController::agregarExperiencia().
  agregarExperiencia(postulacionId: string, datos: ExperienciaInput): Observable<BloqueResponse<Experiencia>> {
    return this.http.post<BloqueResponse<Experiencia>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/experiencias`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 4 — PostulanteController::agregarConocimiento().
  agregarConocimiento(postulacionId: string, datos: ConocimientoInput): Observable<BloqueResponse<Conocimiento>> {
    return this.http.post<BloqueResponse<Conocimiento>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/conocimientos`,
      datos,
      { headers: this.headers() }
    );
  }

  // Editar un bloque ya cargado, sin borrarlo y volver a agregarlo. `documento_url`
  // vacío = no se tocó el archivo: el servidor conserva el que ya tenía el bloque
  // (resumen() ya no expone la ruta física guardada, así que el portal no puede
  // reenviarla si el postulante no eligió un archivo nuevo).
  // PostulanteController::editarFormacion/Experiencia/Conocimiento().
  editarFormacion(postulacionId: string, bloqueId: number, datos: FormacionInput): Observable<BloqueResponse<Formacion>> {
    return this.http.put<BloqueResponse<Formacion>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/formaciones/${bloqueId}`,
      datos,
      { headers: this.headers() }
    );
  }

  editarExperiencia(postulacionId: string, bloqueId: number, datos: ExperienciaInput): Observable<BloqueResponse<Experiencia>> {
    return this.http.put<BloqueResponse<Experiencia>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/experiencias/${bloqueId}`,
      datos,
      { headers: this.headers() }
    );
  }

  editarConocimiento(postulacionId: string, bloqueId: number, datos: ConocimientoInput): Observable<BloqueResponse<Conocimiento>> {
    return this.http.put<BloqueResponse<Conocimiento>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/conocimientos/${bloqueId}`,
      datos,
      { headers: this.headers() }
    );
  }

  // Reordenar un bloque (pág. 47 — flechas arriba/abajo). Puro cosmético: no
  // cambia ningún dato del bloque, solo su posición en la lista.
  // PostulanteController::moverFormacion/Experiencia/Conocimiento(). El primero
  // no se puede mover "arriba" ni el último "abajo" (422).
  moverFormacion(postulacionId: string, bloqueId: number, direccion: DireccionOrden): Observable<QuitarPostulacionResponse> {
    return this.http.patch<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/formaciones/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  moverExperiencia(postulacionId: string, bloqueId: number, direccion: DireccionOrden): Observable<QuitarPostulacionResponse> {
    return this.http.patch<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/experiencias/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  moverConocimiento(postulacionId: string, bloqueId: number, direccion: DireccionOrden): Observable<QuitarPostulacionResponse> {
    return this.http.patch<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/conocimientos/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  // Eliminar un bloque mal cargado (pág. 47 del requerimiento — "Basurero").
  // PostulanteController::eliminarFormacion/Experiencia/Conocimiento(). Solo en
  // ELABORADO; una postulación ya enviada responde 422.
  eliminarFormacion(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/formaciones/${bloqueId}`,
      { headers: this.headers() }
    );
  }

  eliminarExperiencia(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/experiencias/${bloqueId}`,
      { headers: this.headers() }
    );
  }

  eliminarConocimiento(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/conocimientos/${bloqueId}`,
      { headers: this.headers() }
    );
  }

  // Subida de un archivo físico — PostulanteController::subirArchivo(). Va como
  // multipart; NO se fija Content-Type a mano para que el navegador agregue el
  // boundary. La postulación debe estar en ELABORADO.
  subirArchivo(postulacionId: string, tipo: TipoArchivo, archivo: File): Observable<ArchivoSubidoResponse> {
    const formulario = new FormData();
    formulario.append('tipo', tipo);
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<ArchivoSubidoResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/archivos`,
      formulario,
      { headers: this.headers() }
    );
  }

  // Checklist del paso 5 (pág. 54): qué documentos ya se cargaron, cuáles son
  // obligatorios y cuáles faltan. PortalDocumentoPostulacionController::documentos().
  documentos(postulacionId: string): Observable<ChecklistDocumentosResponse> {
    return this.http.get<ChecklistDocumentosResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/documentos`,
      { headers: this.headers() }
    );
  }

  // Ver un documento ya subido (paso 5 — pág. 54-55 del requerimiento).
  // PortalDocumentoPostulacionController::ver(). Se pide como blob (no JSON) y
  // CON el token: un <img [src]> o <iframe [src]> directo a esta URL no
  // funcionaría, porque el navegador arma esa petición por su cuenta y no le
  // puede agregar el header Authorization. Quien use este método arma la URL
  // local del blob (`URL.createObjectURL(blob)`) para meterla en el <img>/
  // <iframe>, y debe revocarla (`URL.revokeObjectURL`) cuando ya no la necesite,
  // para no dejar el blob en memoria. `bloqueId` solo aplica a formacion/
  // experiencia/conocimiento; para foto_perfil/cedula/libreta se omite.
  verDocumento(postulacionId: string, tipo: TipoArchivo, bloqueId?: number): Observable<Blob> {
    const ruta = bloqueId != null
      ? `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/documentos/${tipo}/${bloqueId}`
      : `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/documentos/${tipo}`;
    return this.http.get(ruta, { headers: this.headers(), responseType: 'blob' });
  }

  // Paso 5 (resumen) — PostulanteController::resumen().
  resumen(postulacionId: string): Observable<PostulacionResumenResponse> {
    return this.http.get<PostulacionResumenResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}`,
      { headers: this.headers() }
    );
  }

  // Paso 6 (confirmar) — PostulanteController::confirmar().
  confirmar(postulacionId: string): Observable<BloqueResponse<Postulacion>> {
    return this.http.post<BloqueResponse<Postulacion>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/confirmar`,
      {},
      { headers: this.headers() }
    );
  }

  // Quitar postulación — PostulanteController::quitar(). Solo en ELABORADO y con
  // la convocatoria vigente; una ya enviada responde 422.
  quitar(postulacionId: string): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}`,
      { headers: this.headers() }
    );
  }

  // Mis postulaciones — PostulanteController::misPostulaciones(). El CI puede
  // repetirse entre personas: con `complemento` (1 a 3 letras o números) solo
  // devuelve las de esa persona; sin él, todas las de ese número de CI.
  misPostulaciones(ci: string, complemento?: string): Observable<MisPostulacionesResponse> {
    let params = new HttpParams();
    if (complemento && complemento.trim() !== '') {
      params = params.set('complemento', complemento.trim());
    }
    return this.http.get<MisPostulacionesResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulantes/${encodeURIComponent(ci.trim())}/postulaciones`,
      { headers: this.headers(), params }
    );
  }
}
