import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export type NivelNotificacion = 'info' | 'exito' | 'alerta';

export interface Notificacion {
  id: number;
  tipo: 'POSTULACION_ENVIADA' | 'RESULTADO' | string;
  nivel: NivelNotificacion;
  titulo: string;
  mensaje: string;
  codigo_convocatoria: string | null;
  postulacion_id: string | null; // código de acceso para abrir la postulación
  leida: boolean;
  fecha: string | null; // ISO-8601
}

export interface NotificacionesResponse {
  data: Notificacion[];
  no_leidas: number;
}

// Bandeja "Notificaciones" del postulante. Va por /api/postulante (el servidor
// del portal agrega el token de Ciudadanía Digital). `noLeidas` alimenta el
// contador del menú lateral.
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly http = inject(HttpClient);

  readonly noLeidas = signal(0);

  listar(): Observable<NotificacionesResponse> {
    return this.http
      .get<NotificacionesResponse>('/api/postulante/notificaciones')
      .pipe(tap((r) => this.noLeidas.set(r.no_leidas)));
  }

  marcarLeida(id: number): Observable<unknown> {
    return this.http
      .post(`/api/postulante/notificaciones/${id}/leida`, {})
      .pipe(tap(() => this.noLeidas.update((n) => Math.max(0, n - 1))));
  }

  marcarTodasLeidas(): Observable<unknown> {
    return this.http.post('/api/postulante/notificaciones/leidas', {}).pipe(tap(() => this.noLeidas.set(0)));
  }

  // Solo el contador (menú lateral). Sin sesión no consulta nada.
  refrescarContador(): void {
    this.listar().subscribe({ error: () => this.noLeidas.set(0) });
  }
}
