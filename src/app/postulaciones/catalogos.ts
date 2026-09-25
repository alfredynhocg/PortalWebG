// Opciones de los selects de datos personales. Las comparten el registro del
// usuario (/registro) y el paso 1 de la postulación. Los valores son los
// canónicos que acepta el backend (ver reglasDatosPersonales() en Laravel).

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export const TIPOS_DOCUMENTO: Opcion[] = [
  { valor: 'CI', etiqueta: 'CÉDULA DE IDENTIDAD' },
  { valor: 'PASAPORTE', etiqueta: 'PASAPORTE' },
  { valor: 'CARNET_EXTRANJERIA', etiqueta: 'CARNET DE EXTRANJERÍA' },
];

export const DEPARTAMENTOS: Opcion[] = [
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

export const EXPEDIDOS: Opcion[] = [
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

export const ESTADOS_CIVILES = ['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'CONCUBINO'];

export const GENEROS = ['MASCULINO', 'FEMENINO'];
