// Paso 1 del wizard de postulación (Datos personales).
// Campos y reglas espejan PostulanteController::postular() —
// ver scripts/procesos/convocatorias-personal/3_formulario_postulante/formulario_postulante.json
// en el repo del backend para el detalle campo por campo.
export interface DatosPersonalesPostulante {
  ci: string;
  tipo_documento?: string;
  complemento?: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  apellido_casada?: string;
  utilizar_apellido_casada?: string;
  fecha_nacimiento: string; // yyyy-MM-dd
  expedido: string;
  estado_civil: string;
  genero: string;
  lugar_nacimiento: string;
  departamento: string;
  localidad: string;
  direccion_domicilio: string;
  telefono_domicilio?: string;
  celular: string;
  email: string;
  nro_libreta_militar?: string;
  grupo_sanguineo?: string;
  contacto_emergencia: string;
  foto_perfil_url?: string;
  cedula_identidad_doc_url?: string;
  libreta_militar_doc_url?: string;
}

export interface Postulacion {
  id: number;
  postulante_id: number;
  cas_id: number;
  codigo_convocatoria: string;
  estado: string;
  fecha_registro: string;
  codigo_postulacion?: string | null;
  fecha_envio?: string | null;
}

export interface PostulacionResponse {
  data: Postulacion;
  success: { code: number; mensaje: string };
}

// Paso 2 — Formación Académica (repetible). Espeja
// PostulanteController::agregarFormacion().
export interface FormacionInput {
  nivel_estudios: string;
  tipo_documento: string;
  institucion: string;
  area_formacion: string;
  fecha_inicio: string;
  fecha_fin: string;
  nro_titulo?: string;
  relacionado_cargo: boolean;
  fecha_emision: string;
  nro_registro_profesional?: string;
  documento_url: string;
}

export interface Formacion extends FormacionInput {
  id: number;
  postulacion_id: number;
}

// Paso 3 — Experiencia Laboral (repetible). Espeja
// PostulanteController::agregarExperiencia().
export interface ExperienciaInput {
  institucion: string;
  cargo: string;
  tipo_institucion: 'PUBLICA' | 'PRIVADA';
  clasificacion: 'GENERAL' | 'ESPECIFICA';
  fecha_inicio: string;
  fecha_fin: string;
  modalidad_contrato: string;
  lugar_trabajo: string;
  motivo_desvinculacion: string;
  documento_url: string;
}

export interface Experiencia extends ExperienciaInput {
  id: number;
  postulacion_id: number;
}

// Paso 4 — Conocimientos y Habilidades (repetible). Espeja
// PostulanteController::agregarConocimiento().
export interface ConocimientoInput {
  tipo_curso: 'OBLIGATORIO' | 'OPCIONAL';
  nombre_curso: string;
  duracion_horas: number;
  institucion: string;
  fecha_emision: string;
  documento_url: string;
}

export interface Conocimiento extends ConocimientoInput {
  id: number;
  postulacion_id: number;
}

export interface PostulanteResumen {
  id: number;
  ci: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
}

// Respuesta de GET .../postulaciones/{id} (PostulanteController::resumen()).
export interface PostulacionResumen extends Postulacion {
  postulante: PostulanteResumen;
  formaciones: Formacion[];
  experiencias: Experiencia[];
  experiencias_general: Experiencia[];
  experiencias_especifica: Experiencia[];
  conocimientos: Conocimiento[];
}

export interface PostulacionResumenResponse {
  data: PostulacionResumen;
  success: { code: number; mensaje: string };
}

export interface BloqueResponse<T> {
  data: T;
  success: { code: number; mensaje: string };
}
