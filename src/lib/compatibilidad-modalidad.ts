import { TIPOS_CONTRATO, ETIQUETA_TIPO_CONTRATO, type TipoContrato } from "@/lib/tipo-contrato";

export type CausalContratacionDirecta =
  | "URGENCIA_MANIFIESTA"
  | "EMPRESTITOS"
  | "INTERADMINISTRATIVO"
  | "CIENCIA_TECNOLOGIA"
  | "NO_PLURALIDAD_OFERENTES"
  | "SERVICIOS_PROFESIONALES_APOYO"
  | "ARRENDAMIENTO_INMUEBLES"
  | "ADQUISICION_INMUEBLES"
  | "COMODATO"
  | "PERITOS";

const TODOS = TIPOS_CONTRATO.map((t) => t.valor);
const BIENES_Y_SERVICIOS: TipoContrato[] = ["OBRA", "SUMINISTRO", "COMPRAVENTA", "PRESTACION_SERVICIOS", "ARRENDAMIENTO", "OTRO"];

export const CAUSALES_CONTRATACION_DIRECTA: {
  valor: CausalContratacionDirecta;
  etiqueta: string;
  codigo: string;
  fundamento: string;
  tipos: TipoContrato[];
}[] = [
  {
    valor: "SERVICIOS_PROFESIONALES_APOYO",
    etiqueta: "Prestación de servicios profesionales y de apoyo a la gestión",
    codigo: "CD-CPS",
    fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.9",
    tipos: ["PRESTACION_SERVICIOS"],
  },
  { valor: "INTERADMINISTRATIVO", etiqueta: "Contrato o convenio interadministrativo", codigo: "CD-CI", fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.4", tipos: TODOS },
  { valor: "URGENCIA_MANIFIESTA", etiqueta: "Urgencia manifiesta", codigo: "CD-UM", fundamento: "Ley 80 de 1993, arts. 42 y 43; Decreto 1082 de 2015, art. 2.2.1.2.1.4.2", tipos: TODOS },
  {
    valor: "NO_PLURALIDAD_OFERENTES",
    etiqueta: "Inexistencia de pluralidad de oferentes",
    codigo: "CD-UO",
    fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.8",
    tipos: ["SUMINISTRO", "COMPRAVENTA", "PRESTACION_SERVICIOS", "CONSULTORIA", "OTRO"],
  },
  {
    valor: "CIENCIA_TECNOLOGIA",
    etiqueta: "Actividades científicas y tecnológicas",
    codigo: "CD-ACT",
    fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.7",
    tipos: ["PRESTACION_SERVICIOS", "CONSULTORIA", "SUMINISTRO", "COMPRAVENTA", "OTRO"],
  },
  { valor: "ARRENDAMIENTO_INMUEBLES", etiqueta: "Arrendamiento de inmuebles", codigo: "CD-A", fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.10", tipos: ["ARRENDAMIENTO"] },
  { valor: "ADQUISICION_INMUEBLES", etiqueta: "Adquisición de inmuebles", codigo: "CD-AI", fundamento: "Decreto 1082 de 2015, art. 2.2.1.2.1.4.11", tipos: ["COMPRAVENTA"] },
  { valor: "COMODATO", etiqueta: "Comodato", codigo: "CD-C", fundamento: "Ley 9 de 1989, art. 38", tipos: ["OTRO"] },
  { valor: "EMPRESTITOS", etiqueta: "Empréstitos", codigo: "CD-E", fundamento: "Ley 80 de 1993, art. 41, par. 2", tipos: ["OTRO"] },
  {
    valor: "PERITOS",
    etiqueta: "Peritos o asesores técnicos en procesos judiciales",
    codigo: "CD-P",
    fundamento: "Ley 1150 de 2007, art. 2, num. 4 (adicionado por la Ley 2080 de 2021, art. 82)",
    tipos: ["PRESTACION_SERVICIOS", "CONSULTORIA"],
  },
];

const REGLAS_MODALIDAD: Record<string, { tipos: TipoContrato[]; motivo: string }> = {
  LICITACION_PUBLICA: {
    tipos: BIENES_Y_SERVICIOS,
    motivo: "La consultoría y la interventoría se seleccionan por concurso de méritos (Ley 1150 de 2007, art. 2, num. 3).",
  },
  SELECCION_ABREVIADA_MENOR_CUANTIA: {
    tipos: BIENES_Y_SERVICIOS,
    motivo: "La consultoría y la interventoría se seleccionan por concurso de méritos (Ley 1150 de 2007, art. 2, num. 3).",
  },
  SELECCION_ABREVIADA_SUBASTA_INVERSA: {
    tipos: ["SUMINISTRO", "COMPRAVENTA", "PRESTACION_SERVICIOS", "OTRO"],
    motivo: "La subasta inversa es solo para bienes y servicios de características técnicas uniformes y de común utilización (Decreto 1082 de 2015, art. 2.2.1.2.1.2.2).",
  },
  SELECCION_ABREVIADA_LICITACION_DESIERTA: {
    tipos: BIENES_Y_SERVICIOS,
    motivo: "Procede tras una licitación declarada desierta, con su mismo objeto; la consultoría y la interventoría van por concurso de méritos (Ley 1150 de 2007, art. 2, num. 2, lit. d).",
  },
  SELECCION_ABREVIADA_ACUERDO_MARCO: {
    tipos: ["SUMINISTRO", "COMPRAVENTA", "PRESTACION_SERVICIOS", "ARRENDAMIENTO", "OTRO"],
    motivo: "La compra por catálogo de acuerdos marco de precios es para bienes y servicios de común utilización (Decreto 1082 de 2015, art. 2.2.1.2.1.2.7).",
  },
  SELECCION_ABREVIADA_BOLSA_PRODUCTOS: {
    tipos: ["SUMINISTRO", "COMPRAVENTA", "OTRO"],
    motivo: "La bolsa de productos es para bienes de características técnicas uniformes y productos de origen agropecuario (Ley 1150 de 2007, art. 2, num. 2, lits. a y f).",
  },
  SELECCION_ABREVIADA_ENAJENACION_BIENES: {
    tipos: ["COMPRAVENTA", "OTRO"],
    motivo: "La enajenación de bienes del Estado corresponde a la venta de bienes de la Corporación (Ley 1150 de 2007, art. 2, num. 2, lit. e).",
  },
  CONCURSO_MERITOS: {
    tipos: ["CONSULTORIA", "INTERVENTORIA"],
    motivo: "El concurso de méritos es la modalidad para consultores e interventores (Ley 1150 de 2007, art. 2, num. 3; Manual A-BS-MA01, num. 6.2.3).",
  },
  MINIMA_CUANTIA: { tipos: TODOS, motivo: "" },
  CONVENIO_ASOCIACION: {
    tipos: ["OTRO", "OBRA"],
    motivo: "Los convenios con entidades sin ánimo de lucro y los convenios solidarios de obra se registran como «Otro» u «Obra» (Manual A-BS-MA01, num. 6.2.6).",
  },
  ARRENDAMIENTO: {
    tipos: ["ARRENDAMIENTO"],
    motivo: "Esta modalidad corresponde al arrendamiento de inmuebles (Decreto 1082 de 2015, art. 2.2.1.2.1.4.10).",
  },
  OTRA: { tipos: TODOS, motivo: "" },
};

export function esCausalContratacionDirecta(v: unknown): v is CausalContratacionDirecta {
  return CAUSALES_CONTRATACION_DIRECTA.some((c) => c.valor === v);
}

export function causalDe(v: string | null | undefined) {
  return CAUSALES_CONTRATACION_DIRECTA.find((c) => c.valor === v) ?? null;
}

export function tiposPermitidos(modalidad: string, causal?: string | null): TipoContrato[] {
  if (modalidad === "CONTRATACION_DIRECTA") return causalDe(causal)?.tipos ?? TODOS;
  return REGLAS_MODALIDAD[modalidad]?.tipos ?? TODOS;
}

export function errorCombinacionContrato(modalidad: string, tipo: string, causal?: string | null): string | null {
  if (modalidad === "CONTRATACION_DIRECTA") {
    const c = causalDe(causal);
    if (!c) return "Indique la causal de contratación directa (Decreto 1082 de 2015, art. 2.2.1.2.1.4.1).";
    if (!c.tipos.includes(tipo as TipoContrato)) {
      return `La causal «${c.etiqueta}» no admite contratos de ${ETIQUETA_TIPO_CONTRATO[tipo as TipoContrato]?.toLowerCase() ?? tipo} (${c.fundamento}).`;
    }
    return null;
  }
  const regla = REGLAS_MODALIDAD[modalidad];
  if (regla && !regla.tipos.includes(tipo as TipoContrato)) {
    return `Un contrato de ${ETIQUETA_TIPO_CONTRATO[tipo as TipoContrato]?.toLowerCase() ?? tipo} no se puede seleccionar por esta modalidad. ${regla.motivo}`;
  }
  return null;
}
