import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../postulaciones/errores';

// Inicio de sesión (/ingresar): usuario y contraseña de Keycloak (realm
// externo) validados con grant_type=password desde el servidor del portal.
// Como alternativa ofrece el login por redirección con Ciudadanía Digital.
@Component({
  selector: 'app-ingresar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ingresar.component.html',
  styleUrls: ['../postulaciones/postular.component.css', './ingresar.component.css'],
})
export class IngresarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ActivatedRoute).snapshot.queryParamMap.get('returnTo') ?? undefined;

  usuario = '';
  clave = '';
  readonly verClave = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  async enviar(form: NgForm): Promise<void> {
    if (form.invalid || this.enviando()) {
      form.control.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      const destino = await this.auth.ingresarConClave(this.usuario.trim(), this.clave, this.returnTo);
      await this.router.navigateByUrl(destino);
    } catch (err) {
      this.clave = '';
      this.error.set(
        err instanceof HttpErrorResponse
          ? mensajeError(err, 'No se pudo iniciar sesión. Intenta nuevamente.')
          : 'No se pudo iniciar sesión. Intenta nuevamente.',
      );
    } finally {
      this.enviando.set(false);
    }
  }

  conCiudadania(): void {
    this.auth.loginConCiudadania(this.returnTo);
  }
}
