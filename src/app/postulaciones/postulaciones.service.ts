import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DEMO_CONFIG } from '../demo-config';
import {
  BloqueResponse,
  Conocimiento,
  ConocimientoInput,
  DatosPersonalesPostulante,
  Experiencia,
  ExperienciaInput,
  Formacion,
  FormacionInput,
  Postulacion,
  PostulacionResponse,
  PostulacionResumenResponse,
} from './postulacion.model';

@Injectable({ providedIn: 'root' })
export class PostulacionesService {
  constructor(private http: HttpClient) {}

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
  agregarFormacion(postulacionId: number, datos: FormacionInput): Observable<BloqueResponse<Formacion>> {
    return this.http.post<BloqueResponse<Formacion>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/formaciones`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 3 — PostulanteController::agregarExperiencia().
  agregarExperiencia(postulacionId: number, datos: ExperienciaInput): Observable<BloqueResponse<Experiencia>> {
    return this.http.post<BloqueResponse<Experiencia>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/experiencias`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 4 — PostulanteController::agregarConocimiento().
  agregarConocimiento(postulacionId: number, datos: ConocimientoInput): Observable<BloqueResponse<Conocimiento>> {
    return this.http.post<BloqueResponse<Conocimiento>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/conocimientos`,
      datos,
      { headers: this.headers() }
    );
  }

  // Paso 6 (resumen) — PostulanteController::resumen().
  resumen(postulacionId: number): Observable<PostulacionResumenResponse> {
    return this.http.get<PostulacionResumenResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}`,
      { headers: this.headers() }
    );
  }

  // Paso 6 (confirmar) — PostulanteController::confirmar().
  confirmar(postulacionId: number): Observable<BloqueResponse<Postulacion>> {
    return this.http.post<BloqueResponse<Postulacion>>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/postulaciones/${postulacionId}/confirmar`,
      {},
      { headers: this.headers() }
    );
  }
}
