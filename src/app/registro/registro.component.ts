import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { CuentaService, DatosRegistro, PerfilPortal } from '../core/cuenta.service';
import { mensajeError } from '../postulaciones/errores';
import { DEPARTAMENTOS, ESTADOS_CIVILES, EXPEDIDOS, GENEROS, TIPOS_DOCUMENTO } from '../postulaciones/catalogos';

const CAMPOS_EDITABLES: (keyof DatosRegistro)[] = [
  'tipo_documento', 'nombres', 'apellido_paterno', 'apellido_materno', 'apellido_casada',
  'utilizar_apellido_casada', 'fecha_nacimiento', 'expedido', 'estado_civil', 'genero',
  'lugar_nacimiento', 'departamento', 'localidad', 'direccion_domicilio', 'telefono_domicilio',
  'celular', 'email', 'nro_libreta_militar', 'grupo_sanguineo', 'contacto_emergencia',
];

// Registro del usuario del portal (/registro): la primera vez que inicia sesión
// con Ciudadanía Digital completa sus datos personales; después sirve para
// editarlos. Viene precargado con lo que Ciudadanía Digital ya informó.
@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro.component.html',
  styleUrls: ['../postulaciones/postular.component.css', './registro.component.css'],
})
export class RegistroComponent implements OnInit {
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
    this.cuenta.guardarPerfil(cuerpo).subscribe({
      next: async () => {
        await this.auth.recargar();
        this.enviando.set(false);
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
