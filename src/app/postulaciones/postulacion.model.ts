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
  // Los archivos físicos (foto, cédula, libreta) ya no se mandan acá: se suben
  // después de crear la postulación con PostulacionesService.subirArchivo().
  // Estos campos siguen aceptando una URL http(s) por compatibilidad con el API.
  foto_perfil_url?: string;
  cedula_identidad_doc_url?: string;
  libreta_militar_doc_url?: string;
}

// Tipos de archivo que acepta POST /portal/postulaciones/{id}/archivos.
// Los "simples" quedan guardados en la postulación; los de bloque solo devuelven
// la ruta, que se manda luego como `documento_url` del bloque.
export type TipoArchivoSimple = 'foto_perfil' | 'cedula' | 'libreta';
export type TipoArchivoBloque = 'formacion' | 'experiencia' | 'conocimiento';
export type TipoArchivo = TipoArchivoSimple | TipoArchivoBloque;

export interface ArchivoSubido {
  tipo: TipoArchivo;
  url: string;
  nombre_original: string;
  tamano: number;
}

export interface ArchivoSubidoResponse {
  data: ArchivoSubido;
  success: { code: number; mensaje: string };
}

// `id` es el CÓDIGO DE ACCESO (UUID) que devuelve el paso 1, no un número: es
// la única forma de volver a la postulación (ver PostulacionesService.guardarAcceso).
// `cas_id` es el id numérico de la CONVOCATORIA publicada.
export interface Postulacion {
  id: string;
  postulante_id: string;
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
  postulacion_id: string;
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
  postulacion_id: string;
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
  postulacion_id: string;
}

export interface PostulanteResumen {
  id: string;
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

// Fila de GET /portal/postulantes/{ci}/postulaciones. No trae el código de
// acceso (UUID): el portal lo guardó al crear la postulación y la relaciona
// por `convocatoria`. `convocatoria_activa` es false si la convocatoria fue
// anulada, archivada o ya no está publicada.
export interface MiPostulacion {
  fecha_registro: string | null; // ISO-8601 con zona
  convocatoria: string;
  estado: string;
  codigo_postulacion: string | null;
  cargo: string | null;
  area_solicitante: string | null;
  ubicacion: string | null;
  fecha_publicacion: string | null;
  fecha_limite_postulacion: string | null;
  convocatoria_activa: boolean;
}

export interface MisPostulacionesResponse {
  data: MiPostulacion[];
  success: { code: number; mensaje: string };
}

export interface QuitarPostulacionResponse {
  data: null;
  success: { code: number; mensaje: string };
}
