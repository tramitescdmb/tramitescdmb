export type TipoContrato =
  | "PRESTACION_SERVICIOS"
  | "OBRA"
  | "SUMINISTRO"
  | "COMPRAVENTA"
  | "CONSULTORIA"
  | "INTERVENTORIA"
  | "ARRENDAMIENTO"
  | "OTRO";

export const TIPOS_CONTRATO: { valor: TipoContrato; etiqueta: string }[] = [
  { valor: "PRESTACION_SERVICIOS", etiqueta: "Prestación de servicios" },
  { valor: "OBRA", etiqueta: "Obra" },
  { valor: "SUMINISTRO", etiqueta: "Suministro" },
  { valor: "COMPRAVENTA", etiqueta: "Compraventa" },
  { valor: "CONSULTORIA", etiqueta: "Consultoría" },
  { valor: "INTERVENTORIA", etiqueta: "Interventoría" },
  { valor: "ARRENDAMIENTO", etiqueta: "Arrendamiento" },
  { valor: "OTRO", etiqueta: "Otro" },
];

export const ETIQUETA_TIPO_CONTRATO = Object.fromEntries(TIPOS_CONTRATO.map((t) => [t.valor, t.etiqueta])) as Record<TipoContrato, string>;

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
