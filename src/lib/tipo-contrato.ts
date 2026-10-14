export type TipoContrato =
  | "PRESTACION_SERVICIOS"
  | "OBRA"
  | "SUMINISTRO"
  | "COMPRAVENTA"
  | "CONSULTORIA"
  | "INTERVENTORIA"
  | "ARRENDAMIENTO"
  | "OTRO";

export const TIPOS_CONTRATO: { valor: TipoContrato; codigo: string; etiqueta: string }[] = [
  { valor: "PRESTACION_SERVICIOS", codigo: "PS", etiqueta: "Prestación de servicios" },
  { valor: "OBRA", codigo: "OB", etiqueta: "Obra" },
  { valor: "SUMINISTRO", codigo: "SU", etiqueta: "Suministro" },
  { valor: "COMPRAVENTA", codigo: "CV", etiqueta: "Compraventa" },
  { valor: "CONSULTORIA", codigo: "CO", etiqueta: "Consultoría" },
  { valor: "INTERVENTORIA", codigo: "IN", etiqueta: "Interventoría" },
  { valor: "ARRENDAMIENTO", codigo: "AR", etiqueta: "Arrendamiento" },
  { valor: "OTRO", codigo: "OT", etiqueta: "Otro" },
];

export const ETIQUETA_TIPO_CONTRATO = Object.fromEntries(TIPOS_CONTRATO.map((t) => [t.valor, t.etiqueta])) as Record<TipoContrato, string>;

export const CODIGO_TIPO_CONTRATO = Object.fromEntries(TIPOS_CONTRATO.map((t) => [t.valor, t.codigo])) as Record<TipoContrato, string>;

export function etiquetaTipoConCodigo(tipo: string): string {
  const t = TIPOS_CONTRATO.find((x) => x.valor === tipo);
  return t ? `${t.codigo} · ${t.etiqueta}` : tipo;
}

export type AplicaTipoContrato = "TODOS" | "SOLO_OBRA" | "EXCEPTO_OBRA";

export const ETIQUETA_APLICA_TIPO: Record<AplicaTipoContrato, string> = {
  TODOS: "Todos los contratos",
  SOLO_OBRA: "Solo contratos de obra",
  EXCEPTO_OBRA: "Todos, excepto obra",
};

export function esTipoContrato(v: unknown): v is TipoContrato {
  return TIPOS_CONTRATO.some((t) => t.valor === v);
}

export function requisitoAplica(aplica: AplicaTipoContrato, tipo: TipoContrato): boolean {
  if (aplica === "SOLO_OBRA") return tipo === "OBRA";
  if (aplica === "EXCEPTO_OBRA") return tipo !== "OBRA";
  return true;
}
