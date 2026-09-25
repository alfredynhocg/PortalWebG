import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Notificacion, NotificacionesService } from '../core/notificaciones.service';
import { mensajeError } from './errores';

// Menú lateral → "Notificaciones" (ítem 20c): avisos del proceso de las
// postulaciones del usuario (envío, resultado de la evaluación).
@Component({
  selector: 'app-notificaciones',
  standalone: true,
  templateUrl: './notificaciones.component.html',
  styleUrls: ['./mis-postulaciones.component.css', './notificaciones.component.css'],
})
export class NotificacionesComponent implements OnInit {
  private readonly notificacionesService = inject(NotificacionesService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly notificaciones = signal<Notificacion[]>([]);
  readonly noLeidas = computed(() => this.notificaciones().filter((n) => !n.leida).length);

  ngOnInit(): void {
    this.notificacionesService.listar().subscribe({
      next: (r) => {
        this.notificaciones.set(r.data);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err, 'No se pudieron cargar tus notificaciones.'));
      },
    });
  }

  marcarLeida(n: Notificacion): void {
    if (n.leida) {
      return;
    }
    this.notificaciones.update((lista) => lista.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    this.notificacionesService.marcarLeida(n.id).subscribe({ error: () => undefined });
  }

  marcarTodasLeidas(): void {
    this.notificaciones.update((lista) => lista.map((x) => ({ ...x, leida: true })));
    this.notificacionesService.marcarTodasLeidas().subscribe({ error: () => undefined });
  }

  // Abre la postulación del aviso (el wizard muestra el resumen si ya fue enviada).
  verPostulacion(n: Notificacion): void {
    this.marcarLeida(n);
    if (n.postulacion_id) {
      this.router.navigate(['/convocatorias/postulacion'], {
        queryParams: { id: n.postulacion_id, codigo: n.codigo_convocatoria },
      });
    } else {
      this.router.navigate(['/postulaciones/mis-postulaciones']);
    }
  }

  fecha(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }
}
