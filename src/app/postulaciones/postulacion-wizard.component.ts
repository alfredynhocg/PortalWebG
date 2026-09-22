import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PostulacionesService } from './postulaciones.service';
import { UUID_RE, mensajeError } from './errores';
import { aceptarPara, formatoTamano, mensajeErrorArchivo, validarArchivo, verificarLectura } from './archivos';
import {
  ChecklistDocumentos,
  Conocimiento,
  ConocimientoInput,
  DatosPersonalesPostulante,
  DireccionOrden,
  DocumentoChecklistItem,
  Experiencia,
  ExperienciaInput,
  Formacion,
  FormacionInput,
  Postulacion,
  PostulacionResumen,
  TipoArchivoBloque,
} from './postulacion.model';

type Paso = 1 | 2 | 3 | 4 | 5 | 6;

// Estado del archivo adjunto de un bloque (formación, experiencia, curso). El
// archivo se sube apenas se elige; la ruta que devuelve el API queda en el
// `documento_url` del bloque, que se envía al agregarlo.
// 'cargado': al editar un bloque existente. resumen() ya no expone la ruta
// física guardada (hallazgo de seguridad corregido en el backend), así que acá
// solo se sabe QUE ya tiene un archivo, no cuál — si el postulante no elige uno
// nuevo, el servidor conserva el que ya tenía (ver editarFormacion() del API).
interface Adjunto {
  estado: 'vacio' | 'subiendo' | 'listo' | 'cargado' | 'error';
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
export class PostulacionWizardComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postulacionesService = inject(PostulacionesService);
  private readonly sanitizer = inject(DomSanitizer);

  postulacionId = '';
  codigo = '';

  readonly paso = signal<Paso>(2);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardandoBloque = signal(false);
  readonly eliminandoBloque = signal(false);
  readonly moviendoBloque = signal(false);
  // id del bloque en edición por sección (null = modo "agregar"). El mismo
  // formulario de siempre se reutiliza: al guardar, si hay un id acá, se manda
  // PUT en vez de POST.
  readonly editandoFormacionId = signal<number | null>(null);
  readonly editandoExperienciaId = signal<number | null>(null);
  readonly editandoConocimientoId = signal<number | null>(null);
  readonly resumen = signal<PostulacionResumen | null>(null);
  readonly confirmando = signal(false);
  readonly postulacionConfirmada = signal<Postulacion | null>(null);

  // Paso 5 — Documentos (pág. 54-55).
  readonly checklist = signal<ChecklistDocumentos | null>(null);
  readonly cargandoChecklist = signal(false);
  readonly cargandoVisor = signal(false);
  readonly errorVisor = signal<string | null>(null);
  readonly urlVisorImagen = signal<string | null>(null);
  readonly urlVisorPdf = signal<SafeResourceUrl | null>(null);
  private blobVisorActual: string | null = null;

  readonly aceptarPara = aceptarPara;
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

  // Paso 1 — editar datos personales de una postulación ya creada (pág. 12:
  // "Permitir registrar/actualizar datos personales"). Se prellena con lo que
  // ya devuelve resumen() al entrar; foto/cédula/libreta se manejan aparte, en
  // el paso 5, no acá, para no duplicar la lógica de subida de archivos.
  readonly guardandoDatos = signal(false);
  datosPersonales: DatosPersonalesPostulante = this.datosPersonalesVacios();

  readonly departamentos = [
    { valor: 'LA_PAZ', etiqueta: 'LA PAZ' },
    { valor: 'COCHABAMBA', etiqueta: 'COCHABAMBA' },
    { valor: 'SANTA_CRUZ', etiqueta: 'SANTA CRUZ' },
    { valor: 'ORURO', etiqueta: 'ORURO' },
    { valor: 'POTOSI', etiqueta: 'POTOSÍ' },
    { valor: 'CHUQUISACA', etiqueta: 'CHUQUISACA' },
    { valor: 'TARIJA', etiqueta: 'TARIJA' },
    { valor: 'BENI', etiqueta: 'BENI' },
    { valor: 'PANDO', etiqueta: 'PANDO' },
  ];

  readonly expedidos = [
    { valor: 'LP', etiqueta: 'LA PAZ' },
    { valor: 'CB', etiqueta: 'COCHABAMBA' },
    { valor: 'SC', etiqueta: 'SANTA CRUZ' },
    { valor: 'OR', etiqueta: 'ORURO' },
    { valor: 'PT', etiqueta: 'POTOSÍ' },
    { valor: 'CH', etiqueta: 'CHUQUISACA' },
    { valor: 'TJ', etiqueta: 'TARIJA' },
    { valor: 'BE', etiqueta: 'BENI' },
    { valor: 'PA', etiqueta: 'PANDO' },
  ];

  readonly estadosCiviles = ['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'CONCUBINO'];

  private datosPersonalesVacios(): DatosPersonalesPostulante {
    return {
      ci: '',
      tipo_documento: 'CI',
      complemento: '',
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      apellido_casada: '',
      utilizar_apellido_casada: 'NO',
      fecha_nacimiento: '',
      expedido: '',
      estado_civil: '',
      genero: '',
      lugar_nacimiento: '',
      departamento: '',
      localidad: '',
      direccion_domicilio: '',
      telefono_domicilio: '',
      celular: '',
      email: '',
      nro_libreta_militar: '',
      grupo_sanguineo: '',
      contacto_emergencia: '',
    };
  }

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
        const p = respuesta.data.postulante;
        this.datosPersonales = {
          ci: p.ci ?? '',
          tipo_documento: p.tipo_documento ?? 'CI',
          complemento: p.complemento ?? '',
          nombres: p.nombres ?? '',
          apellido_paterno: p.apellido_paterno ?? '',
          apellido_materno: p.apellido_materno ?? '',
          apellido_casada: p.apellido_casada ?? '',
          utilizar_apellido_casada: p.utilizar_apellido_casada ?? 'NO',
          fecha_nacimiento: p.fecha_nacimiento ?? '',
          expedido: p.expedido ?? '',
          estado_civil: p.estado_civil ?? '',
          genero: p.genero ?? '',
          lugar_nacimiento: p.lugar_nacimiento ?? '',
          departamento: p.departamento ?? '',
          localidad: p.localidad ?? '',
          direccion_domicilio: p.direccion_domicilio ?? '',
          telefono_domicilio: p.telefono_domicilio ?? '',
          celular: p.celular ?? '',
          email: p.email ?? '',
          nro_libreta_militar: p.nro_libreta_militar ?? '',
          grupo_sanguineo: p.grupo_sanguineo ?? '',
          contacto_emergencia: p.contacto_emergencia ?? '',
        };
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
    this.datosGuardados.set(false);
    if (paso === 5) {
      this.cargarChecklist();
    } else {
      this.limpiarVisor();
    }
  }

  readonly datosGuardados = signal(false);

  guardarDatos(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.datosGuardados.set(false);
    this.guardandoDatos.set(true);
    this.postulacionesService.actualizarDatos(this.postulacionId, this.datosPersonales).subscribe({
      next: (respuesta) => {
        this.resumen.set(respuesta.data);
        this.guardandoDatos.set(false);
        this.datosGuardados.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoDatos.set(false);
        this.error.set(mensajeError(err, 'No se pudieron guardar los datos personales.'));
      },
    });
  }

  private cargarChecklist(): void {
    this.cargandoChecklist.set(true);
    this.limpiarVisor();
    this.postulacionesService.documentos(this.postulacionId).subscribe({
      next: (respuesta) => {
        this.checklist.set(respuesta.data);
        this.cargandoChecklist.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoChecklist.set(false);
        this.error.set(mensajeError(err, 'No se pudo cargar el checklist de documentos.'));
      },
    });
  }

  private limpiarVisor(): void {
    if (this.blobVisorActual) {
      URL.revokeObjectURL(this.blobVisorActual);
      this.blobVisorActual = null;
    }
    this.urlVisorImagen.set(null);
    this.urlVisorPdf.set(null);
    this.errorVisor.set(null);
  }

  // Ítem 5c: se pide el binario con el token (verDocumento()) y se arma una
  // URL local (blob:) — un <img>/<iframe> con la URL del API directo no
  // funcionaría sin el header Authorization. Se revoca la anterior antes de
  // pedir una nueva, para no acumular blobs en memoria.
  verDocumentoChecklist(item: DocumentoChecklistItem): void {
    if (!item.cargado) {
      return;
    }
    this.limpiarVisor();
    this.cargandoVisor.set(true);
    this.postulacionesService.verDocumento(this.postulacionId, item.tipo, item.bloque_id ?? undefined).subscribe({
      next: (blob) => {
        this.cargandoVisor.set(false);
        const url = URL.createObjectURL(blob);
        this.blobVisorActual = url;
        if (blob.type === 'application/pdf') {
          this.urlVisorPdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        } else {
          this.urlVisorImagen.set(url);
        }
      },
      error: () => {
        this.cargandoVisor.set(false);
        this.errorVisor.set('No se pudo cargar el documento. Puede estar dañado o no ser accesible.');
      },
    });
  }

  ngOnDestroy(): void {
    this.limpiarVisor();
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
    const problema = validarArchivo(archivo, tipo);
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
    const idEditando = this.editandoFormacionId();
    const peticion = idEditando !== null
      ? this.postulacionesService.editarFormacion(this.postulacionId, idEditando, this.nuevaFormacion)
      : this.postulacionesService.agregarFormacion(this.postulacionId, this.nuevaFormacion);
    peticion.subscribe({
      next: () => {
        this.nuevaFormacion = this.formacionVacia();
        formulario.resetForm(this.nuevaFormacion);
        this.limpiarAdjunto('formacion');
        this.editandoFormacionId.set(null);
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(
          mensajeError(err, idEditando !== null ? 'No se pudieron guardar los cambios de la formación académica.' : 'No se pudo agregar la formación académica.')
        );
      },
    });
  }

  // Precarga el formulario con los datos del bloque para corregirlo (pág. 47).
  // El adjunto ya cargado no se puede mostrar (ver comentario de Adjunto): si
  // el postulante no elige uno nuevo, agregarFormacion() no manda documento_url
  // y el servidor conserva el que ya tenía.
  iniciarEdicionFormacion(f: Formacion): void {
    this.editandoFormacionId.set(f.id);
    this.nuevaFormacion = {
      nivel_estudios: f.nivel_estudios,
      tipo_documento: f.tipo_documento,
      institucion: f.institucion,
      area_formacion: f.area_formacion,
      fecha_inicio: f.fecha_inicio,
      fecha_fin: f.fecha_fin,
      nro_titulo: f.nro_titulo,
      relacionado_cargo: f.relacionado_cargo,
      fecha_emision: f.fecha_emision,
      nro_registro_profesional: f.nro_registro_profesional,
      documento_url: '',
    };
    this.fijarAdjunto('formacion', { estado: 'cargado' });
    this.error.set(null);
  }

  cancelarEdicionFormacion(): void {
    this.editandoFormacionId.set(null);
    this.nuevaFormacion = this.formacionVacia();
    this.limpiarAdjunto('formacion');
  }

  agregarExperiencia(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.guardandoBloque.set(true);
    const idEditando = this.editandoExperienciaId();
    const peticion = idEditando !== null
      ? this.postulacionesService.editarExperiencia(this.postulacionId, idEditando, this.nuevaExperiencia)
      : this.postulacionesService.agregarExperiencia(this.postulacionId, this.nuevaExperiencia);
    peticion.subscribe({
      next: () => {
        this.nuevaExperiencia = this.experienciaVacia();
        formulario.resetForm(this.nuevaExperiencia);
        this.limpiarAdjunto('experiencia');
        this.editandoExperienciaId.set(null);
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(
          mensajeError(err, idEditando !== null ? 'No se pudieron guardar los cambios de la experiencia laboral.' : 'No se pudo agregar la experiencia laboral.')
        );
      },
    });
  }

  iniciarEdicionExperiencia(e: Experiencia): void {
    this.editandoExperienciaId.set(e.id);
    this.nuevaExperiencia = {
      institucion: e.institucion,
      cargo: e.cargo,
      tipo_institucion: e.tipo_institucion,
      clasificacion: e.clasificacion,
      fecha_inicio: e.fecha_inicio,
      fecha_fin: e.fecha_fin,
      modalidad_contrato: e.modalidad_contrato,
      lugar_trabajo: e.lugar_trabajo,
      motivo_desvinculacion: e.motivo_desvinculacion,
      documento_url: '',
    };
    this.fijarAdjunto('experiencia', { estado: 'cargado' });
    this.error.set(null);
  }

  cancelarEdicionExperiencia(): void {
    this.editandoExperienciaId.set(null);
    this.nuevaExperiencia = this.experienciaVacia();
    this.limpiarAdjunto('experiencia');
  }

  agregarConocimiento(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set(this.MENSAJE_CAMPOS_OBLIGATORIOS);
      return;
    }
    this.error.set(null);
    this.guardandoBloque.set(true);
    const idEditando = this.editandoConocimientoId();
    const peticion = idEditando !== null
      ? this.postulacionesService.editarConocimiento(this.postulacionId, idEditando, this.nuevoConocimiento)
      : this.postulacionesService.agregarConocimiento(this.postulacionId, this.nuevoConocimiento);
    peticion.subscribe({
      next: () => {
        this.nuevoConocimiento = this.conocimientoVacio();
        formulario.resetForm(this.nuevoConocimiento);
        this.limpiarAdjunto('conocimiento');
        this.editandoConocimientoId.set(null);
        this.guardandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBloque.set(false);
        this.error.set(
          mensajeError(err, idEditando !== null ? 'No se pudieron guardar los cambios del conocimiento/habilidad.' : 'No se pudo agregar el conocimiento/habilidad.')
        );
      },
    });
  }

  iniciarEdicionConocimiento(c: Conocimiento): void {
    this.editandoConocimientoId.set(c.id);
    this.nuevoConocimiento = {
      tipo_curso: c.tipo_curso,
      nombre_curso: c.nombre_curso,
      duracion_horas: c.duracion_horas,
      institucion: c.institucion,
      fecha_emision: c.fecha_emision,
      documento_url: '',
    };
    this.fijarAdjunto('conocimiento', { estado: 'cargado' });
    this.error.set(null);
  }

  cancelarEdicionConocimiento(): void {
    this.editandoConocimientoId.set(null);
    this.nuevoConocimiento = this.conocimientoVacio();
    this.limpiarAdjunto('conocimiento');
  }

  // Eliminar un bloque mal cargado (pág. 47 — "Basurero"), sin reiniciar la
  // postulación. Mismo patrón que agregarFormacion/Experiencia/Conocimiento.
  eliminarFormacion(bloqueId: number): void {
    if (this.eliminandoBloque()) {
      return;
    }
    this.error.set(null);
    this.eliminandoBloque.set(true);
    this.postulacionesService.eliminarFormacion(this.postulacionId, bloqueId).subscribe({
      next: () => {
        this.eliminandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.eliminandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo eliminar la formación académica.'));
      },
    });
  }

  eliminarExperiencia(bloqueId: number): void {
    if (this.eliminandoBloque()) {
      return;
    }
    this.error.set(null);
    this.eliminandoBloque.set(true);
    this.postulacionesService.eliminarExperiencia(this.postulacionId, bloqueId).subscribe({
      next: () => {
        this.eliminandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.eliminandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo eliminar la experiencia laboral.'));
      },
    });
  }

  eliminarConocimiento(bloqueId: number): void {
    if (this.eliminandoBloque()) {
      return;
    }
    this.error.set(null);
    this.eliminandoBloque.set(true);
    this.postulacionesService.eliminarConocimiento(this.postulacionId, bloqueId).subscribe({
      next: () => {
        this.eliminandoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.eliminandoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo eliminar el conocimiento/habilidad.'));
      },
    });
  }

  // Reordenar (flechas arriba/abajo, pág. 47). Puro cosmético: no cambia datos
  // del bloque, solo su posición. Mismo patrón que eliminarX().
  moverFormacion(bloqueId: number, direccion: DireccionOrden): void {
    if (this.moviendoBloque()) {
      return;
    }
    this.error.set(null);
    this.moviendoBloque.set(true);
    this.postulacionesService.moverFormacion(this.postulacionId, bloqueId, direccion).subscribe({
      next: () => {
        this.moviendoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.moviendoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo reordenar la formación académica.'));
      },
    });
  }

  moverExperiencia(bloqueId: number, direccion: DireccionOrden): void {
    if (this.moviendoBloque()) {
      return;
    }
    this.error.set(null);
    this.moviendoBloque.set(true);
    this.postulacionesService.moverExperiencia(this.postulacionId, bloqueId, direccion).subscribe({
      next: () => {
        this.moviendoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.moviendoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo reordenar la experiencia laboral.'));
      },
    });
  }

  moverConocimiento(bloqueId: number, direccion: DireccionOrden): void {
    if (this.moviendoBloque()) {
      return;
    }
    this.error.set(null);
    this.moviendoBloque.set(true);
    this.postulacionesService.moverConocimiento(this.postulacionId, bloqueId, direccion).subscribe({
      next: () => {
        this.moviendoBloque.set(false);
        this.cargarResumen(false);
      },
      error: (err: HttpErrorResponse) => {
        this.moviendoBloque.set(false);
        this.error.set(mensajeError(err, 'No se pudo reordenar el conocimiento/habilidad.'));
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
