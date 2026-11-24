import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Claims del id_token que manda Keycloak cuando el login viene de Ciudadanía Digital.
export interface UsuarioCiudadania {
  preferred_username?: string;
  email?: string;
  fecha_nacimiento?: string;
  celular?: string;
  profile?: {
    documento_identidad?: { tipo_documento?: string; numero_documento?: string };
    nombre?: { nombres?: string; primer_apellido?: string; segundo_apellido?: string };
  };
  [claim: string]: unknown;
}

// Respuesta de Laravel (POST /api/portal/sesion) tras verificar el token y registrar al usuario.
export interface UsuarioBackend {
  ci: string;
  complemento: string | null;
  nombre: string | null;
  registro_completo: boolean;
}

export interface AuthSession {
  authenticated: boolean;
  user?: UsuarioCiudadania;
  backend?: UsuarioBackend;
}

// URL de una ruta del servidor del portal (Express), relativa al <base href>:
// '/auth/login' en local, '/portal/auth/login' en el servidor.
function urlDelPortal(ruta: string): string {
  return new URL(ruta, document.baseURI).href;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  readonly session = signal<AuthSession>({ authenticated: false });
  readonly loaded = signal(false);

  // Nombre para el encabezado: nombres de Ciudadanía Digital; si no vienen
  // (usuarios locales de Keycloak), el CI que devolvió Laravel.
  readonly nombreVisible = computed(() => {
    const { user, backend } = this.session();
    return user?.profile?.nombre?.nombres ?? backend?.ci ?? user?.preferred_username ?? 'Ciudadano';
  });

  readonly registroCompleto = computed(() => this.session().backend?.registro_completo === true);

  private cargaEnCurso: Promise<void> | null = null;

  // Primera carga de la sesión (la dispara App al arrancar). Los guards la
  // esperan con sesionLista() para no decidir antes de saber si hay sesión.
  loadSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }
    this.cargaEnCurso ??= this.recargar();
    return this.cargaEnCurso;
  }

  sesionLista(): Promise<void> {
    return this.loadSession();
  }

  // Vuelve a pedir la sesión (p. ej. después de completar el registro).
  async recargar(): Promise<void> {
    try {
      const session = await firstValueFrom(this.http.get<AuthSession>('api/auth/session'));
      this.session.set(session);
    } catch {
      this.session.set({ authenticated: false });
    } finally {
      this.loaded.set(true);
    }
  }

  // Lleva a la pantalla de ingreso del portal (/ingresar), que vuelve a
  // returnTo después de iniciar sesión.
  login(returnTo?: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const destino = returnTo ?? this.router.url;
    this.router.navigate(['/ingresar'], {
      queryParams: destino && destino !== '/' && !destino.startsWith('/ingresar') ? { returnTo: destino } : {},
    });
  }

  // Usuario y contraseña de Keycloak (grant password). El POST a /token lo
  // hace el servidor del portal; devuelve la ruta a la que hay que ir después.
  async ingresarConClave(username: string, password: string, returnTo?: string): Promise<string> {
    const { redirectTo } = await firstValueFrom(
      this.http.post<{ redirectTo: string }>('auth/password', { username, password, returnTo }),
    );
    await this.recargar();
    return redirectTo;
  }

  // Alternativa: login por redirección (Keycloak → Ciudadanía Digital).
  loginConCiudadania(returnTo?: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const destino = encodeURIComponent(returnTo ?? '/');
    window.location.href = urlDelPortal(`auth/login?returnTo=${destino}`);
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    window.location.href = urlDelPortal('auth/logout');
  }
}
