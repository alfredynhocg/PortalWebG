import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PostulacionesService } from './postulaciones.service';
import { mensajeError } from './errores';
import { EstadoMiPostulacion, MiPostulacion } from './postulacion.model';

// Pantalla "Mis postulaciones" (pág. 58-60 del requerimiento): bandeja de
// seguimiento del postulante. Como todavía no hay integración real con
// Ciudadanía Digital (ítem 21, pendiente de credenciales oficiales), la
// identificación es la misma que ya usa el resto del portal: CI + complemento
// tipeados a mano — no hay sesión de la que tomar el CI del usuario logueado.
@Component({
  selector: 'app-mis-postulaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-postulaciones.component.html',
  styleUrl: './mis-postulaciones.component.css',
})
export class MisPostulacionesComponent {
  private readonly postulacionesService = inject(PostulacionesService);
  private readonly router = inject(Router);

  ci = '';
  complemento = '';

  readonly buscando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resultados = signal<MiPostulacion[] | null>(null);
  // id de la postulación con la confirmación de "Quitar" abierta (evita un
  // window.confirm(): no hay librería de diálogos en este portal).
  readonly confirmandoQuitarId = signal<string | null>(null);
  readonly quitandoId = signal<string | null>(null);

  buscar(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.confirmandoQuitarId.set(null);
    this.buscando.set(true);
    this.resultados.set(null);
    this.postulacionesService.misPostulaciones(this.ci, this.complemento).subscribe({
      next: (respuesta) => {
        this.buscando.set(false);
        this.resultados.set(respuesta.data);
      },
      error: (err: HttpErrorResponse) => {
        this.buscando.set(false);
        this.error.set(mensajeError(err, 'No se pudieron cargar tus postulaciones.'));
      },
    });
  }

  // Retoma el wizard (si sigue en ELABORADO) o solo la deja ver (resumen()
  // igual funciona sobre una ya enviada, PostulacionWizardComponent la detecta
  // y muestra el mensaje de "ya no se puede modificar").
  continuar(item: MiPostulacion): void {
    this.router.navigate(['/convocatorias/postulacion'], {
      queryParams: { id: item.id, codigo: item.convocatoria },
    });
  }

  pedirConfirmacionQuitar(item: MiPostulacion): void {
    this.confirmandoQuitarId.set(item.id);
  }

  cancelarQuitar(): void {
    this.confirmandoQuitarId.set(null);
  }

  confirmarQuitar(item: MiPostulacion): void {
    if (this.quitandoId()) {
      return;
    }
    this.quitandoId.set(item.id);
    this.postulacionesService.quitar(item.id).subscribe({
      next: () => {
        this.quitandoId.set(null);
        this.confirmandoQuitarId.set(null);
        this.resultados.update((actuales) => (actuales ?? []).filter((p) => p.id !== item.id));
      },
      error: (err: HttpErrorResponse) => {
        this.quitandoId.set(null);
        this.confirmandoQuitarId.set(null);
        this.error.set(mensajeError(err, 'No se pudo quitar la postulación.'));
      },
    });
  }

  // pág. 59: catálogo cerrado de estados.
  etiquetaEstado(estado: EstadoMiPostulacion): string {
    switch (estado) {
      case 'ELABORADO':
        return 'Elaborado';
      case 'ENVIADO':
        return 'Enviado';
      case 'EN_REVISION':
        return 'En revisión';
      case 'HABILITADO':
        return 'Habilitado';
      case 'INHABILITADO':
        return 'Inhabilitado';
      default:
        return estado;
    }
  }
}
