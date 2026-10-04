import type { EtapaContratacion, ModalidadSeleccion, RolContratacion } from "@prisma/client";

export const ETAPAS_ORDEN: EtapaContratacion[] = ["PRECONTRACTUAL", "CONTRACTUAL", "POSTCONTRACTUAL"];

export function etapaHabilitada(etapaActual: EtapaContratacion, etapa: EtapaContratacion): boolean {
  return ETAPAS_ORDEN.indexOf(etapa) <= ETAPAS_ORDEN.indexOf(etapaActual);
}

export function mensajeEtapaNoHabilitada(etapa: EtapaContratacion): string {
  return `La etapa ${ETIQUETA_ETAPA[etapa]} aún no está habilitada: primero debe aprobarse la etapa anterior.`;
}

export const ETIQUETA_ETAPA: Record<EtapaContratacion, string> = {
  PRECONTRACTUAL: "Precontractual",
  CONTRACTUAL: "Contractual",
  POSTCONTRACTUAL: "Postcontractual",
};

export const ETIQUETA_MODALIDAD: Record<ModalidadSeleccion, string> = {
  LICITACION_PUBLICA: "Licitación pública",
  SELECCION_ABREVIADA_MENOR_CUANTIA: "Selección abreviada — menor cuantía",
  SELECCION_ABREVIADA_SUBASTA_INVERSA: "Selección abreviada — subasta inversa",
  SELECCION_ABREVIADA_ENAJENACION_BIENES: "Selección abreviada — enajenación de bienes",
  CONCURSO_MERITOS: "Concurso de méritos",
  CONTRATACION_DIRECTA: "Contratación directa",
  MINIMA_CUANTIA: "Mínima cuantía",
  CONVENIO_ASOCIACION: "Convenio de asociación (ESAL)",
  ARRENDAMIENTO: "Arrendamiento de inmuebles",
  OTRA: "Otra modalidad",
};

export const ETIQUETA_ROL_CONTRATACION: Record<RolContratacion, string> = {
  ADMINISTRADOR_CONTRATACION: "Administrador de Contratación",
  JEFE_CONTRATACION: "Jefe de Contratación",
  FUNCIONARIO_CONTRATACION: "Personal de Contratación",
  JEFE_DEPENDENCIA: "Jefe de dependencia / Subdirector",
  SUPERVISOR_INTERVENTOR: "Supervisor / Interventor",
  CONTRATISTA: "Contratista",
};

export const ORDEN_MODALIDADES: ModalidadSeleccion[] = [
  "CONTRATACION_DIRECTA",
  "MINIMA_CUANTIA",
  "SELECCION_ABREVIADA_MENOR_CUANTIA",
  "SELECCION_ABREVIADA_SUBASTA_INVERSA",
  "SELECCION_ABREVIADA_ENAJENACION_BIENES",
  "CONCURSO_MERITOS",
  "LICITACION_PUBLICA",
  "CONVENIO_ASOCIACION",
  "ARRENDAMIENTO",
  "OTRA",
];
