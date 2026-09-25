import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Perfil guardado en procesos-internos (tabla portal_usuarios). ci/complemento
// vienen del token de Ciudadanía Digital y no se pueden editar.
export interface PerfilPortal {
  ci: string;
  complemento: string | null;
  tipo_documento: string | null;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  apellido_casada: string | null;
  utilizar_apellido_casada: string | null;
  fecha_nacimiento: string | null; // yyyy-MM-dd
  expedido: string | null;
  estado_civil: string | null;
  genero: string | null;
  lugar_nacimiento: string | null;
  departamento: string | null;
  localidad: string | null;
  direccion_domicilio: string | null;
  telefono_domicilio: string | null;
  celular: string | null;
  email: string | null;
  nro_libreta_militar: string | null;
  grupo_sanguineo: string | null;
  contacto_emergencia: string | null;
  registro_completo_at: string | null;
}

export interface PerfilResponse {
  data: {
    ci: string;
    complemento: string | null;
    nombre: string | null;
    registro_completo: boolean;
    // Campos que informó Ciudadanía Digital: se muestran bloqueados y el
    // backend ignora cualquier cambio sobre ellos.
    campos_bloqueados: string[];
    perfil: PerfilPortal;
  };
}

// Campos que el usuario puede editar (PUT). Sin ci/complemento.
export type DatosRegistro = Omit<PerfilPortal, 'ci' | 'complemento' | 'registro_completo_at'>;

// Habla con /api/cuenta/* del servidor del portal (misma cookie de sesión),
// que reenvía a Laravel agregando el token de Keycloak.
@Injectable({ providedIn: 'root' })
export class CuentaService {
  private readonly http = inject(HttpClient);

  perfil(): Observable<PerfilResponse> {
    return this.http.get<PerfilResponse>('/api/cuenta/perfil');
  }

  guardarPerfil(datos: DatosRegistro): Observable<PerfilResponse> {
    return this.http.put<PerfilResponse>('/api/cuenta/perfil', datos);
  }
}
