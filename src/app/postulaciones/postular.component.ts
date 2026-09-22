import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PostulacionesService } from './postulaciones.service';
import { DatosPersonalesPostulante, TipoArchivoSimple } from './postulacion.model';
import { mensajeError } from './errores';
import { aceptarPara, esImagen, formatoTamano, mensajeErrorArchivo, validarArchivo, verificarLectura } from './archivos';

// Archivo elegido para uno de los 3 documentos del paso 1. Se sube recién
// después de crear la postulación (el API lo asocia a ella).
interface DocumentoPostulante {
  archivo: File | null;
  estado: 'vacio' | 'pendiente' | 'subiendo' | 'listo' | 'error';
  mensaje?: string;
  vista?: string; // blob: para previsualizar la fotografía
}

const DOCUMENTO_VACIO: DocumentoPostulante = { archivo: null, estado: 'vacio' };

// Paso 1 de 6 del wizard de postulación (Datos personales + documentos: foto,
// cédula y libreta militar). Los pasos 2-6 viven en PostulacionWizardComponent.
@Component({
  selector: 'app-postular',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './postular.component.html',
  styleUrl: './postular.component.css',
})
export class PostularComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postulacionesService = inject(PostulacionesService);

  codigo = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  // UUID de una postulación previa de este mismo CI guardada en este navegador
  // (el API no lo devuelve en el 409): permite ofrecer "continuar".
  readonly postulacionExistenteId = signal<string | null>(null);
  // Código de acceso de la postulación recién creada en esta pantalla. Si la
  // subida de algún documento falla, "Reintentar" reutiliza esta postulación en
  // vez de volver a crearla (que respondería 409).
  readonly postulacionCreadaId = signal<string | null>(null);

  readonly aceptarPara = aceptarPara;
  readonly formatoTamano = formatoTamano;
  // Límites y formatos de cada uno viven en archivos.ts (LIMITES_ARCHIVO), por
  // tipo: foto ≤2MB JPG/PNG; cédula y libreta solo PDF ≤3MB (pág. 43-46).
  readonly documentosConfig: { tipo: TipoArchivoSimple; etiqueta: string }[] = [
    { tipo: 'foto_perfil', etiqueta: 'Fotografía de perfil' },
    { tipo: 'cedula', etiqueta: 'Cédula de identidad' },
    { tipo: 'libreta', etiqueta: 'Libreta militar' },
  ];
  readonly documentos = signal<Record<TipoArchivoSimple, DocumentoPostulante>>({
    foto_perfil: DOCUMENTO_VACIO,
    cedula: DOCUMENTO_VACIO,
    libreta: DOCUMENTO_VACIO,
  });

  datos: DatosPersonalesPostulante = {
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

  ngOnInit(): void {
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (!codigo) {
      this.router.navigateByUrl('/');
      return;
    }
    this.codigo = codigo;
  }

  ngOnDestroy(): void {
    Object.values(this.documentos()).forEach((doc) => this.liberarVista(doc));
  }

  private liberarVista(doc: DocumentoPostulante): void {
    if (doc.vista) {
      URL.revokeObjectURL(doc.vista);
    }
  }

  private fijarDocumento(tipo: TipoArchivoSimple, cambios: Partial<DocumentoPostulante>): void {
    this.documentos.update((actuales) => ({ ...actuales, [tipo]: { ...actuales[tipo], ...cambios } }));
  }

  seleccionarDocumento(evento: Event, tipo: TipoArchivoSimple): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    this.liberarVista(this.documentos()[tipo]);

    if (!archivo) {
      this.documentos.update((actuales) => ({ ...actuales, [tipo]: DOCUMENTO_VACIO }));
      return;
    }

    const problema = validarArchivo(archivo, tipo);
    if (problema) {
      input.value = '';
      this.documentos.update((actuales) => ({ ...actuales, [tipo]: { archivo: null, estado: 'error', mensaje: problema } }));
      return;
    }

    this.documentos.update((actuales) => ({
      ...actuales,
      [tipo]: { archivo, estado: 'pendiente', vista: esImagen(tipo) ? URL.createObjectURL(archivo) : undefined },
    }));

    void verificarLectura(archivo).then((ilegible) => {
      // si mientras tanto se eligió otro archivo, este resultado ya no aplica
      if (!ilegible || this.documentos()[tipo].archivo !== archivo) {
        return;
      }
      this.liberarVista(this.documentos()[tipo]);
      input.value = '';
      this.documentos.update((actuales) => ({ ...actuales, [tipo]: { archivo: null, estado: 'error', mensaje: ilegible } }));
    });
  }

  quitarDocumento(tipo: TipoArchivoSimple, input: HTMLInputElement): void {
    this.liberarVista(this.documentos()[tipo]);
    input.value = '';
    this.documentos.update((actuales) => ({ ...actuales, [tipo]: DOCUMENTO_VACIO }));
  }

  // Sube los documentos elegidos que aún no se subieron. Uno por uno, para que
  // un fallo no oculte cuáles sí quedaron guardados.
  private async subirDocumentos(postulacionId: string): Promise<void> {
    this.enviando.set(true);
    this.error.set(null);
    let fallidos = 0;

    for (const { tipo } of this.documentosConfig) {
      const doc = this.documentos()[tipo];
      if (!doc.archivo || doc.estado === 'listo') {
        continue;
      }
      this.fijarDocumento(tipo, { estado: 'subiendo', mensaje: undefined });
      try {
        await firstValueFrom(this.postulacionesService.subirArchivo(postulacionId, tipo, doc.archivo));
        this.fijarDocumento(tipo, { estado: 'listo' });
      } catch (err) {
        fallidos++;
        this.fijarDocumento(tipo, {
          estado: 'error',
          mensaje: mensajeErrorArchivo(err as HttpErrorResponse),
        });
      }
    }

    this.enviando.set(false);
    if (fallidos === 0) {
      this.irAlSiguientePaso(postulacionId);
    } else {
      this.error.set(
        `Tu postulación se creó, pero ${fallidos} documento(s) no se pudieron subir. ` +
          'Puedes reintentar o continuar sin ellos (no podrás agregarlos después).'
      );
    }
  }

  continuarSinDocumentos(): void {
    const id = this.postulacionCreadaId();
    if (id) {
      this.irAlSiguientePaso(id);
    }
  }

  enviar(formulario: NgForm): void {
    // Postulación ya creada en este intento: solo faltaba subir documentos.
    const creada = this.postulacionCreadaId();
    if (creada) {
      void this.subirDocumentos(creada);
      return;
    }

    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.postulacionExistenteId.set(null);

    this.postulacionesService.postular(this.codigo, this.datos).subscribe({
      next: (respuesta) => {
        this.postulacionesService.guardarAcceso(this.codigo, this.datos.ci, this.datos.complemento, respuesta.data.id);
        this.postulacionCreadaId.set(respuesta.data.id);
        void this.subirDocumentos(respuesta.data.id);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 409) {
          // Ya existe una postulación de este CI para esta convocatoria. El 409
          // NO devuelve el código de acceso; si esta misma persona la creó desde
          // este navegador, se ofrece continuarla.
          this.postulacionExistenteId.set(
            this.postulacionesService.obtenerAcceso(this.codigo, this.datos.ci, this.datos.complemento)
          );
        }
        this.error.set(mensajeError(err, 'No se pudo enviar la postulación. Intenta nuevamente.'));
      },
    });
  }

  continuarPostulacionExistente(): void {
    const id = this.postulacionExistenteId();
    if (id) {
      this.irAlSiguientePaso(id);
    }
  }

  private irAlSiguientePaso(postulacionId: string): void {
    this.router.navigate(['/convocatorias/postulacion'], {
      queryParams: { id: postulacionId, codigo: this.codigo },
    });
  }

  volver(): void {
    this.router.navigate(['/convocatorias/detalle'], { queryParams: { codigo: this.codigo } });
  }
}
