export interface Convocatoria {
  codigo: string;
  cargo: string;
  area_solicitante: string;
  ubicacion: string;
  tipo_contrato: string;
  tipo_convocatoria: string; // INTERNA / EXTERNA
  vacantes: string;
  fecha_publicacion: string;
  fecha_limite_postulacion: string;
}

export interface ConvocatoriasResponse {
  data: Convocatoria[];
  totalRegistros: number;
  success: { code: number; mensaje: string };
}

export interface ConvocatoriaRequisitos {
  denominacion: string;
  nivel_salarial: string;
  haber_mensual: string;
  haber_mensual_literal: string;
  formacion: string;
  area_profesional: string;
  experiencia_general: string;
  experiencia_especifica: string;
}

export interface ConvocatoriaDetalle extends Convocatoria {
  contacto_consultas: string;
  descripcion_cargo: string;
  funciones_principales: string[];
  requisitos: ConvocatoriaRequisitos;
  documentos: string[];
  vigente: boolean;
}

export interface ConvocatoriaDetalleResponse {
  data: ConvocatoriaDetalle;
  success: { code: number; mensaje: string };
}

export interface ConvocatoriasFiltros {
  buscar?: string;
  area?: string;
  tipo_contrato?: string;
  ubicacion?: string;
  page?: number;
  per_page?: number;
}

export type ConvocatoriasStreamResultado =
  | { ok: true; respuesta: ConvocatoriasResponse }
  | { ok: false; status?: number };

export interface FormularioCampoItem {
  frm_value: string;
  frm_etiqueta: string;
}

export interface FormularioCampo {
  frm_tipo: string;
  frm_campo: string;
  frm_etiqueta?: string;
  frm_obligatorio?: string;
  frm_items?: FormularioCampoItem[];
}

export interface FormularioPublicacion {
  frm_id: number;
  frm_codigo: string;
  frm_descripcion: string;
  campos: FormularioCampo[];
}

export interface FormularioPublicacionResponse {
  data: FormularioPublicacion;
  success: { code: number; mensaje: string };
}
