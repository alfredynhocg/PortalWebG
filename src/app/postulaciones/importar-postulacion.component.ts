import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { PostulacionesService } from './postulaciones.service';
import { mensajeError } from './errores';
import {
  BloqueImportable,
  DuplicadoImportacion,
  ImportarInput,
  ImportarResponse,
  MotivoOmision,
  PostulacionImportable,
  PostulacionResumen,
  SeccionImportable,
} from './postulacion.model';

interface SeccionVista {
  clave: SeccionImportable;
  titulo: string;
  ayuda: string | null;
}

// Modal "Traer de otra postulación". Lista las postulaciones ENVIADAS del
// postulante (importables) y deja elegir qué copiar al borrador actual.
// - Lo que ya está en el borrador (`ya_en_postulacion`) o no tiene PDF no se
//   puede elegir: el backend respondería 409 o lo omitiría.
// - 409: se muestra el mensaje, se recarga la lista (quedan deshabilitados).
// - 500 con `reintentar`: no se guardó nada; botón "Reintentar" con la misma selección.
// Al terminar emite `importado` con el resumen nuevo para refrescar el wizard.
@Component({
  selector: 'app-importar-postulacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './importar-postulacion.component.html',
  styleUrl: './importar-postulacion.component.css',
})
export class ImportarPostulacionComponent implements OnInit {
  private readonly postulaciones = inject(PostulacionesService);

  readonly postulacionId = input.required<string>();
  // Sección que se abre marcada por defecto (la del paso desde el que se abrió).
  readonly seccionInicial = input<SeccionImportable | null>(null);
  readonly cerrar = output<void>();
  readonly importado = output<PostulacionResumen>();

  readonly secciones: SeccionVista[] = [
    { clave: 'formaciones', titulo: 'Formación académica', ayuda: 'Quedará "por revisar": confirma si está relacionada con este cargo.' },
    { clave: 'experiencias', titulo: 'Experiencia laboral', ayuda: 'Quedará "por revisar": confirma la clasificación para este cargo.' },
    { clave: 'conocimientos', titulo: 'Conocimientos y habilidades', ayuda: null },
  ];

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly origenes = signal<PostulacionImportable[]>([]);
  readonly origenId = signal<string | null>(null);
  readonly seleccion = signal<Record<SeccionImportable, Set<number>>>(this.seleccionVacia());
  readonly cedula = signal(false);
  readonly libreta = signal(false);

  readonly error = signal<string | null>(null);
  readonly puedeReintentar = signal(false);
  readonly resultado = signal<ImportarResponse | null>(null);

  readonly origen = computed(() => this.origenes().find((o) => o.id === this.origenId()) ?? null);

  readonly totalSeleccionado = computed(() => {
    const s = this.seleccion();
    return s.formaciones.size + s.experiencias.size + s.conocimientos.size + (this.cedula() ? 1 : 0) + (this.libreta() ? 1 : 0);
  });

  ngOnInit(): void {
    this.cargar();
  }

  private seleccionVacia(): Record<SeccionImportable, Set<number>> {
    return { formaciones: new Set(), experiencias: new Set(), conocimientos: new Set() };
  }

  // `mantenerOrigen`: al recargar tras un 409 se queda en la misma postulación.
  private cargar(mantenerOrigen = false): void {
    this.cargando.set(true);
    this.postulaciones.importables(this.postulacionId()).subscribe({
      next: (respuesta) => {
        this.origenes.set(respuesta.data);
        const actual = mantenerOrigen ? this.origenId() : null;
        const elegido = respuesta.data.find((o) => o.id === actual) ?? respuesta.data[0] ?? null;
        this.elegirOrigen(elegido?.id ?? null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err, 'No se pudieron cargar tus postulaciones anteriores.'));
      },
    });
  }

  // Al cambiar de postulación se preselecciona todo lo disponible de la
  // sección inicial (o de todas si se abrió sin sección).
  elegirOrigen(id: string | null): void {
    this.origenId.set(id);
    this.error.set(null);
    this.puedeReintentar.set(false);
    const origen = this.origenes().find((o) => o.id === id);
    const nueva = this.seleccionVacia();
    if (origen) {
      for (const { clave } of this.secciones) {
        if (this.seccionInicial() === null || this.seccionInicial() === clave) {
          origen[clave].filter((b) => this.disponible(b)).forEach((b) => nueva[clave].add(b.id));
        }
      }
    }
    this.seleccion.set(nueva);
    this.cedula.set(!!origen && this.seccionInicial() === null && this.documentoDisponible('cedula', origen));
    this.libreta.set(!!origen && this.seccionInicial() === null && this.documentoDisponible('libreta', origen));
  }

  disponible(b: BloqueImportable): boolean {
    return b.tiene_documento && !b.ya_en_postulacion;
  }

  documentoDisponible(tipo: 'cedula' | 'libreta', origen: PostulacionImportable): boolean {
    return origen[tipo].tiene_documento && !origen[tipo].ya_en_postulacion;
  }

  motivoNoDisponible(b: BloqueImportable): string | null {
    if (b.ya_en_postulacion) {
      return 'Ya está en esta postulación';
    }
    if (!b.tiene_documento) {
      return 'No tiene documento';
    }
    return null;
  }

  estaMarcado(seccion: SeccionImportable, id: number): boolean {
    return this.seleccion()[seccion].has(id);
  }

  alternar(seccion: SeccionImportable, id: number): void {
    this.seleccion.update((s) => {
      const copia = { ...s, [seccion]: new Set(s[seccion]) };
      if (copia[seccion].has(id)) {
        copia[seccion].delete(id);
      } else {
        copia[seccion].add(id);
      }
      return copia;
    });
  }

  disponibles(seccion: SeccionImportable): BloqueImportable[] {
    return (this.origen()?.[seccion] ?? []).filter((b) => this.disponible(b));
  }

  todosMarcados(seccion: SeccionImportable): boolean {
    const libres = this.disponibles(seccion);
    return libres.length > 0 && libres.every((b) => this.estaMarcado(seccion, b.id));
  }

  alternarSeccion(seccion: SeccionImportable): void {
    const marcar = !this.todosMarcados(seccion);
    this.seleccion.update((s) => ({
      ...s,
      [seccion]: new Set(marcar ? this.disponibles(seccion).map((b) => b.id) : []),
    }));
  }

  importar(): void {
    const origen = this.origen();
    if (!origen || this.totalSeleccionado() === 0 || this.enviando()) {
      return;
    }
    const s = this.seleccion();
    const datos: ImportarInput = { origen: origen.id };
    for (const { clave } of this.secciones) {
      if (s[clave].size) {
        datos[clave] = [...s[clave]];
      }
    }
    if (this.cedula()) {
      datos.cedula = true;
    }
    if (this.libreta()) {
      datos.libreta = true;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.puedeReintentar.set(false);
    this.postulaciones.importar(this.postulacionId(), datos).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.resultado.set(respuesta);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        const cuerpo = err.error?.error;
        if (err.status === 409) {
          const duplicados = (cuerpo?.duplicados ?? []) as DuplicadoImportacion[];
          const detalle = duplicados.length ? ` (${duplicados.map((d) => this.nombreDuplicado(d)).join(', ')})` : '';
          this.error.set(`${cuerpo?.message ?? 'Algunos registros ya están en esta postulación.'}${detalle}`);
          // La lista se recarga: lo que ya está queda deshabilitado.
          this.cargar(true);
          return;
        }
        this.puedeReintentar.set(err.status === 0 || err.status >= 500 || cuerpo?.reintentar === true);
        this.error.set(
          err.status >= 500
            ? cuerpo?.message ?? 'No se pudo completar la importación. No se guardó ningún cambio; vuelve a intentarlo.'
            : mensajeError(err, 'No se pudo completar la importación.')
        );
      },
    });
  }

  private nombreDuplicado(d: DuplicadoImportacion): string {
    if (d.seccion === 'cedula') {
      return 'cédula de identidad';
    }
    if (d.seccion === 'libreta') {
      return 'libreta militar';
    }
    const bloque = this.origen()?.[d.seccion].find((b) => b.id === d.origen_id);
    return bloque?.titulo ?? `registro ${d.origen_id}`;
  }

  // Textos de los motivos de omisión (README, sección 4.2).
  textoMotivo(motivo: MotivoOmision): string {
    switch (motivo) {
      case 'LIMITE':
        return 'se alcanzó el máximo de registros de la sección';
      case 'NO_EXISTE':
        return 'ya no existe en la postulación de origen';
      case 'VALIDACION':
        return 'faltan datos o no son válidos: agrégalo manualmente';
      case 'SIN_DOCUMENTO_ORIGEN':
        return 'la postulación de origen no tiene el documento';
      default:
        return motivo;
    }
  }

  nombreOmitido(seccion: string, origenId?: number): string {
    if (seccion === 'cedula') {
      return 'Cédula de identidad';
    }
    if (seccion === 'libreta') {
      return 'Libreta militar';
    }
    const bloque = this.origen()?.[seccion as SeccionImportable]?.find((b) => b.id === origenId);
    return bloque?.titulo ?? `Registro ${origenId ?? ''}`;
  }

  totalPorRevisar(r: ImportarResponse): number {
    const i = r.data.importados;
    return [...i.formaciones, ...i.experiencias, ...i.conocimientos].filter((b) => b.por_revisar).length;
  }

  terminar(): void {
    const r = this.resultado();
    if (r) {
      this.importado.emit(r.data.resumen);
    }
    this.cerrar.emit();
  }

  cancelar(): void {
    if (!this.enviando()) {
      this.cerrar.emit();
    }
  }
}
