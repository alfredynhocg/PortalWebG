import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConvocatoriasService } from './convocatorias.service';
import { ConvocatoriaDetalle, FormularioCampo } from './convocatoria.model';

// Tipos decorativos del motor de formularios (títulos/subtítulos) que no
// representan un dato a mostrar en la lista de campos.
const TIPOS_NO_CAMPO = new Set(['TITLE', 'SUBTITLE', 'BUTTON_FA', 'GRID']);

@Component({
  selector: 'app-convocatoria-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './convocatoria-detalle.component.html',
  styleUrl: './convocatoria-detalle.component.css',
})
export class ConvocatoriaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly convocatoriasService = inject(ConvocatoriasService);

  readonly convocatoria = signal<ConvocatoriaDetalle | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly formularioCampos = signal<FormularioCampo[]>([]);
  readonly formularioError = signal<string | null>(null);

  ngOnInit(): void {
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (!codigo) {
      this.router.navigateByUrl('/');
      return;
    }

    this.convocatoriasService.detalles(codigo).subscribe({
      next: (respuesta) => {
        this.convocatoria.set(respuesta.data);
        this.error.set(respuesta.data ? null : 'No se encontró la convocatoria solicitada.');
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 401
            ? 'Token de demo vencido o inválido. Genera uno nuevo (ver demo-config.ts).'
            : 'No se pudo cargar el detalle de la convocatoria.'
        );
        this.cargando.set(false);
      },
    });

    // Independiente del detalle: si este servicio falla, no debe tumbar el
    // resto de la página (solo se oculta esta sección).
    this.convocatoriasService.formularioPublicacion().subscribe({
      next: (respuesta) => {
        const campos = (respuesta.data.campos ?? []).filter((c) => !TIPOS_NO_CAMPO.has(c.frm_tipo));
        this.formularioCampos.set(campos);
      },
      error: () => {
        this.formularioError.set('No se pudo cargar la estructura del formulario de convocatoria publicada.');
      },
    });
  }

  volver(): void {
    this.router.navigateByUrl('/');
  }

  postularme(): void {
    const c = this.convocatoria();
    if (!c) {
      return;
    }
    this.router.navigate(['/convocatorias/postular'], { queryParams: { codigo: c.codigo } });
  }

  tituloCase(texto: string | null | undefined): string {
    if (!texto) {
      return '';
    }
    return texto
      .toLowerCase()
      .split(' ')
      .map((palabra) => (palabra ? palabra[0].toUpperCase() + palabra.slice(1) : palabra))
      .join(' ');
  }

  fechaCorta(fechaIso: string | null | undefined): string {
    if (!fechaIso) {
      return '';
    }
    const [anio, mes, dia] = fechaIso.split('-');
    return `${dia}/${mes}/${anio}`;
  }
}
