import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { CuentaService, DatosRegistro, PerfilPortal } from '../core/cuenta.service';
import { mensajeError } from '../postulaciones/errores';
import { DEPARTAMENTOS, ESTADOS_CIVILES, EXPEDIDOS, GENEROS, TIPOS_DOCUMENTO } from '../postulaciones/catalogos';
import { aceptarPara, validarArchivo, verificarLectura } from '../postulaciones/archivos';

const CAMPOS_EDITABLES: (keyof DatosRegistro)[] = [
  'tipo_documento', 'nombres', 'apellido_paterno', 'apellido_materno', 'apellido_casada',
  'utilizar_apellido_casada', 'fecha_nacimiento', 'expedido', 'estado_civil', 'genero',
  'lugar_nacimiento', 'departamento', 'localidad', 'direccion_domicilio', 'telefono_domicilio',
  'celular', 'email', 'nro_libreta_militar', 'grupo_sanguineo', 'contacto_emergencia',
];

// Registro del usuario del portal (/registro): la primera vez que inicia sesión
// con Ciudadanía Digital completa sus datos personales; después (/mi-perfil) es
// el ÚNICO lugar donde se editan los datos personales y la fotografía. Las
// postulaciones los toman de aquí y los muestran de solo lectura.
@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro.component.html',
  styleUrls: ['../postulaciones/postular.component.css', './registro.component.css'],
})
export class RegistroComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly cuenta = inject(CuentaService);
  private readonly auth = inject(AuthService);

  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly departamentos = DEPARTAMENTOS;
  readonly expedidos = EXPEDIDOS;
  readonly estadosCiviles = ESTADOS_CIVILES;
  readonly generos = GENEROS;

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardado = signal(false);
  readonly primeraVez = signal(true);
  readonly ci = signal('');
  readonly bloqueados = signal<ReadonlySet<string>>(new Set());

  // Fotografía de la cuenta: la guardada (data: URI) y la elegida para
  // reemplazarla (se sube al guardar, después de los datos).
  readonly aceptarFoto = aceptarPara('foto_perfil');
  readonly fotoActual = signal<string | null>(null);
  readonly fotoNueva = signal<File | null>(null);
  readonly vistaFotoNueva = signal<string | null>(null);
  readonly errorFoto = signal<string | null>(null);

  // En el formulario todo es string ('' = vacío); se convierte a null al enviar.
  datos = Object.fromEntries(CAMPOS_EDITABLES.map((c) => [c, ''])) as Record<keyof DatosRegistro, string>;

  ngOnInit(): void {
    this.cuenta.perfil().subscribe({
      next: ({ data }) => {
        this.primeraVez.set(!data.registro_completo);
        this.ci.set(data.complemento ? `${data.ci}-${data.complemento}` : data.ci);
        this.bloqueados.set(new Set(data.campos_bloqueados ?? []));
        this.precargar(data.perfil);
        this.cargando.set(false);
        this.cargarFoto();
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        if (err.status === 401 || err.status === 404) {
          this.auth.login('/registro');
          return;
        }
        this.error.set(mensajeError(err, 'No se pudo cargar tu perfil. Intenta nuevamente.'));
      },
    });
  }

  ngOnDestroy(): void {
    this.liberarVistaFoto();
  }

  // true = el dato viene de Ciudadanía Digital y no se puede modificar.
  bloqueado(campo: keyof DatosRegistro): boolean {
    return this.bloqueados().has(campo);
  }

  private precargar(perfil: PerfilPortal): void {
    for (const campo of CAMPOS_EDITABLES) {
      this.datos[campo] = perfil[campo] ?? '';
    }
    this.datos.tipo_documento ||= 'CI';
  }

  private cargarFoto(): void {
    this.cuenta.fotoPerfil().subscribe({
      next: (foto) => this.fotoActual.set(foto.tiene_foto ? foto.contenido : null),
      error: () => this.fotoActual.set(null), // sin foto visible; no bloquea el formulario
    });
  }

  private liberarVistaFoto(): void {
    const vista = this.vistaFotoNueva();
    if (vista) {
      URL.revokeObjectURL(vista);
    }
    this.vistaFotoNueva.set(null);
  }

  seleccionarFoto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.liberarVistaFoto();
    this.fotoNueva.set(null);
    this.errorFoto.set(null);
    this.guardado.set(false);
    if (!archivo) {
      return;
    }

    const problema = validarArchivo(archivo, 'foto_perfil');
    if (problema) {
      input.value = '';
      this.errorFoto.set(problema);
      return;
    }
    this.fotoNueva.set(archivo);
    this.vistaFotoNueva.set(URL.createObjectURL(archivo));

    void verificarLectura(archivo).then((ilegible) => {
      // si mientras tanto se eligió otra, este resultado ya no aplica
      if (ilegible && this.fotoNueva() === archivo) {
        this.quitarFotoNueva(input);
        this.errorFoto.set(ilegible);
      }
    });
  }

  quitarFotoNueva(input: HTMLInputElement): void {
    input.value = '';
    this.fotoNueva.set(null);
    this.liberarVistaFoto();
  }

  private leerComoDataUri(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(archivo);
    });
  }

  // Sube la foto elegida (si hay). Va después de guardar los datos porque
  // Laravel valida el perfil completo en el mismo PUT. true = sin errores.
  private async subirFotoNueva(): Promise<boolean> {
    const archivo = this.fotoNueva();
    if (!archivo) {
      return true;
    }
    try {
      const foto = await firstValueFrom(this.cuenta.guardarFoto(await this.leerComoDataUri(archivo)));
      this.fotoActual.set(foto.tiene_foto ? foto.contenido : null);
      this.fotoNueva.set(null);
      this.liberarVistaFoto();
      return true;
    } catch (err) {
      this.errorFoto.set(
        err instanceof HttpErrorResponse
          ? mensajeError(err, 'No se pudo guardar la fotografía. Intenta nuevamente.')
          : 'No se pudo leer la fotografía. Elige otra.',
      );
      return false;
    }
  }

  enviar(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados en rojo.');
      return;
    }

    const cuerpo = Object.fromEntries(
      CAMPOS_EDITABLES.map((c) => [c, this.datos[c].trim() === '' ? null : this.datos[c].trim()])
    ) as DatosRegistro;

    this.enviando.set(true);
    this.error.set(null);
    this.guardado.set(false);
    this.cuenta.guardarPerfil(cuerpo).subscribe({
      next: async () => {
        await this.auth.recargar();
        const fotoOk = await this.subirFotoNueva();
        this.enviando.set(false);
        if (!fotoOk) {
          return; // los datos sí se guardaron; el error de la foto queda a la vista
        }
        if (this.primeraVez()) {
          // Registro completo: al listado de convocatorias, desde donde entra
          // al detalle y "Postularme" (el paso 1 ya viene con estos datos).
          await this.router.navigate(['/'], { queryParams: { registro: 'ok' } });
          return;
        }
        this.guardado.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 401) {
          this.auth.login('/registro');
          return;
        }
        this.error.set(mensajeError(err, 'No se pudo guardar tu registro. Intenta nuevamente.'));
      },
    });
  }
}
