import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
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
  MiPostulacion,
  MisPostulacionesResponse,
  Postulacion,
  PostulacionResponse,
  PostulacionResumenResponse,
  QuitarPostulacionResponse,
  TipoArchivo,
} from './postulacion.model';

// Llamadas del postulante: pasan por el servidor del portal (/api/postulante),
// que las reenvía a Laravel (/api/portal) con el token de Ciudadanía Digital
// de la sesión. El CI lo pone el backend a partir del token.
const BASE = '/api/postulante';

@Injectable({ providedIn: 'root' })
export class PostulacionesService {
  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Accept: 'application/json' });
  }

  // Paso 1 — PostulanteController::postular().
  postular(codigo: string, datos: DatosPersonalesPostulante): Observable<PostulacionResponse> {
    return this.http.post<PostulacionResponse>(
      `${BASE}/convocatorias/${codigo}/postulaciones`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 1 (edición) — PostulanteController::actualizarDatos(). A diferencia
  // de postular(), esto actualiza una postulación ya creada; solo funciona
  // mientras esté en ELABORADO (422 si ya fue enviada).
  actualizarDatos(postulacionId: string, datos: DatosPersonalesPostulante): Observable<PostulacionResumenResponse> {
    return this.http.put<PostulacionResumenResponse>(
      `${BASE}/postulaciones/${postulacionId}/datos`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 2 — PostulanteController::agregarFormacion().
  agregarFormacion(postulacionId: string, datos: FormacionInput): Observable<BloqueResponse<Formacion>> {
    return this.http.post<BloqueResponse<Formacion>>(
      `${BASE}/postulaciones/${postulacionId}/formaciones`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 3 — PostulanteController::agregarExperiencia().
  agregarExperiencia(postulacionId: string, datos: ExperienciaInput): Observable<BloqueResponse<Experiencia>> {
    return this.http.post<BloqueResponse<Experiencia>>(
      `${BASE}/postulaciones/${postulacionId}/experiencias`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 4 — PostulanteController::agregarConocimiento().
  agregarConocimiento(postulacionId: string, datos: ConocimientoInput): Observable<BloqueResponse<Conocimiento>> {
    return this.http.post<BloqueResponse<Conocimiento>>(
      `${BASE}/postulaciones/${postulacionId}/conocimientos`,
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
      `${BASE}/postulaciones/${postulacionId}/formaciones/${bloqueId}`,
      datos,
      { headers: this.headers() }
    );
  }

  editarExperiencia(postulacionId: string, bloqueId: number, datos: ExperienciaInput): Observable<BloqueResponse<Experiencia>> {
    return this.http.put<BloqueResponse<Experiencia>>(
      `${BASE}/postulaciones/${postulacionId}/experiencias/${bloqueId}`,
      datos,
      { headers: this.headers() }
    );
  }

  editarConocimiento(postulacionId: string, bloqueId: number, datos: ConocimientoInput): Observable<BloqueResponse<Conocimiento>> {
    return this.http.put<BloqueResponse<Conocimiento>>(
      `${BASE}/postulaciones/${postulacionId}/conocimientos/${bloqueId}`,
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
      `${BASE}/postulaciones/${postulacionId}/formaciones/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  moverExperiencia(postulacionId: string, bloqueId: number, direccion: DireccionOrden): Observable<QuitarPostulacionResponse> {
    return this.http.patch<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}/experiencias/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  moverConocimiento(postulacionId: string, bloqueId: number, direccion: DireccionOrden): Observable<QuitarPostulacionResponse> {
    return this.http.patch<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}/conocimientos/${bloqueId}/orden`,
      { direccion },
      { headers: this.headers() }
    );
  }

  // Eliminar un bloque mal cargado (pág. 47 del requerimiento — "Basurero").
  // PostulanteController::eliminarFormacion/Experiencia/Conocimiento(). Solo en
  // ELABORADO; una postulación ya enviada responde 422.
  eliminarFormacion(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}/formaciones/${bloqueId}`,
      { headers: this.headers() }
    );
  }

  eliminarExperiencia(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}/experiencias/${bloqueId}`,
      { headers: this.headers() }
    );
  }

  eliminarConocimiento(postulacionId: string, bloqueId: number): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}/conocimientos/${bloqueId}`,
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
      `${BASE}/postulaciones/${postulacionId}/archivos`,
      formulario,
      { headers: this.headers() }
    );
  }

  // Checklist del paso 5 (pág. 54): qué documentos ya se cargaron, cuáles son
  // obligatorios y cuáles faltan. PortalDocumentoPostulacionController::documentos().
  documentos(postulacionId: string): Observable<ChecklistDocumentosResponse> {
    return this.http.get<ChecklistDocumentosResponse>(
      `${BASE}/postulaciones/${postulacionId}/documentos`,
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
      ? `${BASE}/postulaciones/${postulacionId}/documentos/${tipo}/${bloqueId}`
      : `${BASE}/postulaciones/${postulacionId}/documentos/${tipo}`;
    return this.http.get(ruta, { headers: this.headers(), responseType: 'blob' });
  }

  // Paso 5 (resumen) — PostulanteController::resumen().
  resumen(postulacionId: string): Observable<PostulacionResumenResponse> {
    return this.http.get<PostulacionResumenResponse>(
      `${BASE}/postulaciones/${postulacionId}`,
      { headers: this.headers() }
    );
  }

  // Paso 6 (confirmar) — PostulanteController::confirmar().
  confirmar(postulacionId: string): Observable<BloqueResponse<Postulacion>> {
    return this.http.post<BloqueResponse<Postulacion>>(
      `${BASE}/postulaciones/${postulacionId}/confirmar`,
      {},
      { headers: this.headers() }
    );
  }

  // Quitar postulación — PostulanteController::quitar(). Solo en ELABORADO y con
  // la convocatoria vigente; una ya enviada responde 422.
  quitar(postulacionId: string): Observable<QuitarPostulacionResponse> {
    return this.http.delete<QuitarPostulacionResponse>(
      `${BASE}/postulaciones/${postulacionId}`,
      { headers: this.headers() }
    );
  }

  // Mis postulaciones — PostulanteController::misPostulaciones(). Las del CI
  // de la sesión (Ciudadanía Digital): ya no se pide el CI.
  misPostulaciones(): Observable<MisPostulacionesResponse> {
    return this.http.get<MisPostulacionesResponse>(`${BASE}/mis-postulaciones`, { headers: this.headers() });
  }

  // La postulación del usuario en esa convocatoria, si ya tiene una (una sola
  // por CI y convocatoria: el backend no deja duplicarla). null = puede postular.
  postulacionEnConvocatoria(codigo: string): Observable<MiPostulacion | null> {
    return this.misPostulaciones().pipe(
      map((respuesta) => respuesta.data.find((p) => p.convocatoria === codigo) ?? null)
    );
  }
}
