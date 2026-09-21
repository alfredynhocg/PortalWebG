import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PostulacionesService } from './postulaciones.service';
import { UUID_RE, mensajeError } from './errores';
import { ACEPTAR_DOCUMENTO, formatoTamano, mensajeErrorArchivo, validarArchivo, verificarLectura } from './archivos';
import {
  ConocimientoInput,
  ExperienciaInput,
  FormacionInput,
  Postulacion,
  PostulacionResumen,
  TipoArchivoBloque,
} from './postulacion.model';

type Paso = 2 | 3 | 4 | 6;

// Estado del archivo adjunto de un bloque (formación, experiencia, curso). El
// archivo se sube apenas se elige; la ruta que devuelve el API queda en el
// `documento_url` del bloque, que se envía al agregarlo.
interface Adjunto {
  estado: 'vacio' | 'subiendo' | 'listo' | 'error';
  nombre?: string;
  tamano?: number;
  mensaje?: string;
}

const ADJUNTO_VACIO: Adjunto = { estado: 'vacio' };

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

  postulacionId = '';
  codigo = '';

  readonly paso = signal<Paso>(2);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardandoBloque = signal(false);
  readonly resumen = signal<PostulacionResumen | null>(null);
  readonly confirmando = signal(false);
  readonly postulacionConfirmada = signal<Postulacion | null>(null);

  readonly aceptarDocumento = ACEPTAR_DOCUMENTO;
  readonly formatoTamano = formatoTamano;
  readonly adjuntos = signal<Record<TipoArchivoBloque, Adjunto>>({
    formacion: ADJUNTO_VACIO,
    experiencia: ADJUNTO_VACIO,
    conocimiento: ADJUNTO_VACIO,
  });
  private readonly archivoFormacion = viewChild<ElementRef<HTMLInputElement>>('archivoFormacion');
  private readonly archivoExperiencia = viewChild<ElementRef<HTMLInputElement>>('archivoExperiencia');
  private readonly archivoConocimiento = viewChild<ElementRef<HTMLInputElement>>('archivoConocimiento');

  nuevaFormacion: FormacionInput = this.formacionVacia();
  nuevaExperiencia: ExperienciaInput = this.experienciaVacia();
  nuevoConocimiento: ConocimientoInput = this.conocimientoVacio();

  ngOnInit(): void {
    // El id es el código de acceso (UUID) del paso 1; un id numérico (enlaces
    // viejos) no existe para el API (404), así que ni se intenta.
    const id = this.route.snapshot.queryParamMap.get('id') ?? '';
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (!UUID_RE.test(id) || !codigo) {
      this.router.navigateByUrl('/');
      return;
    }
    this.postulacionId = id;
    this.codigo = codigo;
    this.cargarResumen();
  }

  // `mostrarCarga = false` refresca el resumen sin reemplazar la pantalla por
  // "Cargando...": así el formulario no se destruye ni la página salta arriba
  // después de agregar un bloque.
  private cargarResumen(mostrarCarga = true): void {
    if (mostrarCarga) {
      this.cargando.set(true);
    }
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
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 404
            ? 'No se encontró la postulación (fue quitada o el enlace no es válido).'
            : mensajeError(err, 'No se pudo cargar la postulación.')
        );
        this.cargando.set(false);
      },
    });
  }

  private readonly MENSAJE_CAMPOS_OBLIGATORIOS = 'Completa los campos obligatorios (*) marcados en rojo.';

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

  private fijarAdjunto(tipo: TipoArchivoBloque, adjunto: Adjunto): void {
    this.adjuntos.update((actuales) => ({ ...actuales, [tipo]: adjunto }));
  }

  private fijarDocumentoUrl(tipo: TipoArchivoBloque, url: string): void {
    if (tipo === 'formacion') {
      this.nuevaFormacion.documento_url = url;
    } else if (tipo === 'experiencia') {
      this.nuevaExperiencia.documento_url = url;
    } else {
      this.nuevoConocimiento.documento_url = url;
    }
  }

  private limpiarAdjunto(tipo: TipoArchivoBloque): void {
    const referencia =
      tipo === 'formacion' ? this.archivoFormacion() : tipo === 'experiencia' ? this.archivoExperiencia() : this.archivoConocimiento();
    const input = referencia?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.fijarAdjunto(tipo, ADJUNTO_VACIO);
  }

  // Se llama al elegir un archivo: lo valida y lo sube de inmediato.
  seleccionarArchivo(evento: Event, tipo: TipoArchivoBloque): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) {
      return;
    }

    this.error.set(null);
    this.fijarDocumentoUrl(tipo, '');
    const problema = validarArchivo(archivo, false);
    if (problema) {
      input.value = '';
      this.fijarAdjunto(tipo, { estado: 'error', mensaje: problema });
      return;
    }

    this.fijarAdjunto(tipo, { estado: 'subiendo', nombre: archivo.name, tamano: archivo.size });
    void verificarLectura(archivo).then((ilegible) => {
      if (ilegible) {
        input.value = '';
        this.fijarAdjunto(tipo, { estado: 'error', mensaje: ilegible });
        return;
      }
      this.postulacionesService.subirArchivo(this.postulacionId, tipo, archivo).subscribe({
        next: (respuesta) => {
          this.fijarDocumentoUrl(tipo, respuesta.data.url);
          this.fijarAdjunto(tipo, { estado: 'listo', nombre: archivo.name, tamano: archivo.size });
        },
        error: (err: HttpErrorResponse) => {
          input.value = '';
          this.fijarAdjunto(tipo, { estado: 'error', mensaje: mensajeErrorArchivo(err) });
        },
      });
    });
  }

  agregarFormacion(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarFormacion(this.postulacionId, this.nuevaFormacion).subscribe({
      next: () => {
        this.nuevaFormacion = this.formacionVacia();
        formulario.resetForm(this.nuevaFormacion);
        this.limpiarAdjunto('formacion');
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo agregar la formación académica.'));
      },
    });
  }

  agregarExperiencia(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarExperiencia(this.postulacionId, this.nuevaExperiencia).subscribe({
      next: () => {
        this.nuevaExperiencia = this.experienciaVacia();
        formulario.resetForm(this.nuevaExperiencia);
        this.limpiarAdjunto('experiencia');
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo agregar la experiencia laboral.'));
      },
    });
  }

  agregarConocimiento(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.guardandoBloque.set(true);
    this.postulacionesService.agregarConocimiento(this.postulacionId, this.nuevoConocimiento).subscribe({
      next: () => {
        this.nuevoConocimiento = this.conocimientoVacio();
        formulario.resetForm(this.nuevoConocimiento);
        this.limpiarAdjunto('conocimiento');
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo agregar el conocimiento/habilidad.'));
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
        this.error.set(mensajeError(err, 'No se pudo confirmar la postulación.'));
      },
    });
  }

  volver(): void {
    this.router.navigate(['/convocatorias/detalle'], { queryParams: { codigo: this.codigo } });
  }
}
