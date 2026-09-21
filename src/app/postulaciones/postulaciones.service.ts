import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DEMO_CONFIG } from '../demo-config';
import {
  ArchivoSubidoResponse,
  BloqueResponse,
  Conocimiento,
  ConocimientoInput,
  DatosPersonalesPostulante,
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
