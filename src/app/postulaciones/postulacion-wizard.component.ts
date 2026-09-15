import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PostulacionesService } from './postulaciones.service';
import {
  ConocimientoInput,
  ExperienciaInput,
  FormacionInput,
  Postulacion,
  PostulacionResumen,
} from './postulacion.model';

type Paso = 2 | 3 | 4 | 6;

// Pasos 2-6 del wizard de postulación. El paso 1 (datos personales, que crea
// la postulación) vive en PostularComponent; este componente continúa desde
// una postulación ya existente (?id=...).
@Component({
  selector: 'app-postulacion-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './postulacion-wizard.component.html',
  styleUrl: './postulacion-wizard.component.css',
})
export class PostulacionWizardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postulacionesService = inject(PostulacionesService);

  postulacionId = 0;
  codigo = '';

  readonly paso = signal<Paso>(2);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardandoBloque = signal(false);
  readonly resumen = signal<PostulacionResumen | null>(null);
  readonly confirmando = signal(false);
  readonly postulacionConfirmada = signal<Postulacion | null>(null);

  nuevaFormacion: FormacionInput = this.formacionVacia();
  nuevaExperiencia: ExperienciaInput = this.experienciaVacia();
  nuevoConocimiento: ConocimientoInput = this.conocimientoVacio();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (!id || !codigo) {
      this.router.navigateByUrl('/');
      return;
    }
    this.postulacionId = id;
    this.codigo = codigo;
    this.cargarResumen();
  }

  private cargarResumen(): void {
    this.cargando.set(true);
    this.postulacionesService.resumen(this.postulacionId).subscribe({
      next: (respuesta) => {
        this.resumen.set(respuesta.data);
        // Si ya se envió (ENVIADO/EN_EVALUACION/CONCLUIDO), no es editable:
        // PostulanteController::postulacionEditable() solo permite cambios en
        // ELABORADO. Se detecta acá para avisar de entrada en vez de dejar
        // que el postulante llene el wizard y recién se entere al confirmar.
        if (respuesta.data.estado !== 'ELABORADO') {
          this.postulacionConfirmada.set(respuesta.data);
        }
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la postulación.');
        this.cargando.set(false);
      },
    });
  }

  irAPaso(paso: Paso): void {
    this.paso.set(paso);
    this.error.set(null);
  }

  private formacionVacia(): FormacionInput {
    return {
      nivel_estudios: '',
      tipo_documento: '',
      institucion: '',
      area_formacion: '',
      fecha_inicio: '',
      fecha_fin: '',
      nro_titulo: '',
      relacionado_cargo: false,
      fecha_emision: '',
      nro_registro_profesional: '',
      documento_url: '',
    };
  }

  private experienciaVacia(): ExperienciaInput {
    return {
      institucion: '',
      cargo: '',
      tipo_institucion: 'PUBLICA',
      clasificacion: 'GENERAL',
      fecha_inicio: '',
      fecha_fin: '',
      modalidad_contrato: '',
      lugar_trabajo: '',
      motivo_desvinculacion: '',
      documento_url: '',
    };
  }

  private conocimientoVacio(): ConocimientoInput {
    return {
      tipo_curso: 'OBLIGATORIO',
      nombre_curso: '',
      duracion_horas: 1,
      institucion: '',
      fecha_emision: '',
      documento_url: '',
    };
  }

  agregarFormacion(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarFormacion(this.postulacionId, this.nuevaFormacion).subscribe({
      next: () => {
        this.nuevaFormacion = this.formacionVacia();
        formulario.resetForm(this.nuevaFormacion);
        this.guardandoBloque.set(false);
        this.cargarResumen();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(err.error?.error?.message ?? 'No se pudo agregar la formación académica.');
      },
    });
  }

  agregarExperiencia(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarExperiencia(this.postulacionId, this.nuevaExperiencia).subscribe({
      next: () => {
        this.nuevaExperiencia = this.experienciaVacia();
        formulario.resetForm(this.nuevaExperiencia);
        this.guardandoBloque.set(false);
        this.cargarResumen();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(err.error?.error?.message ?? 'No se pudo agregar la experiencia laboral.');
      },
    });
  }

  agregarConocimiento(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarConocimiento(this.postulacionId, this.nuevoConocimiento).subscribe({
      next: () => {
        this.nuevoConocimiento = this.conocimientoVacio();
        formulario.resetForm(this.nuevoConocimiento);
        this.guardandoBloque.set(false);
        this.cargarResumen();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(err.error?.error?.message ?? 'No se pudo agregar el conocimiento/habilidad.');
      },
    });
  }

  confirmar(): void {
    this.confirmando.set(true);
    this.error.set(null);
    this.postulacionesService.confirmar(this.postulacionId).subscribe({
      next: (respuesta) => {
        this.confirmando.set(false);
        this.postulacionConfirmada.set(respuesta.data);
      },
      error: (err: HttpErrorResponse) => {
        this.confirmando.set(false);
        this.error.set(err.error?.error?.message ?? 'No se pudo confirmar la postulación.');
      },
    });
  }

  volver(): void {
    this.router.navigate(['/convocatorias/detalle'], { queryParams: { codigo: this.codigo } });
  }
}
