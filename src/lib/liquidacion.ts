export const CODIGO_ACTA_LIQUIDACION = "A-BS-FO135";
export const TIPOS_SIN_LIQUIDACION_OBLIGATORIA = ["PRESTACION_SERVICIOS", "COMPRAVENTA"];

export type FaseLiquidacion = "en-ejecucion" | "mutuo-acuerdo" | "unilateral" | "residual" | "sin-competencia" | "liquidado" | "no-requiere";

const MS_DIA = 24 * 60 * 60 * 1000;

function sumarMeses(fecha: Date, meses: number): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, fecha.getUTCDate()));
}

export function requiereLiquidacion(tipoContrato: string, terminadoAnticipadamente: boolean): boolean {
  return terminadoAnticipadamente || !TIPOS_SIN_LIQUIDACION_OBLIGATORIA.includes(tipoContrato);
}

export function plazosLiquidacion(terminacion: Date) {
  const mutuoAcuerdo = sumarMeses(terminacion, 6);
  const unilateral = sumarMeses(mutuoAcuerdo, 2);
  const residual = sumarMeses(unilateral, 24);
  return { mutuoAcuerdo, unilateral, residual };
}

export const ETIQUETA_FASE_LIQUIDACION: Record<FaseLiquidacion, string> = {
  "en-ejecucion": "En ejecución",
  "mutuo-acuerdo": "Liquidar de mutuo acuerdo",
  unilateral: "Liquidar unilateralmente",
  residual: "Liquidar (término residual)",
  "sin-competencia": "Competencia para liquidar perdida",
  liquidado: "Liquidado",
  "no-requiere": "No requiere liquidación",
};

export function estadoLiquidacion(datos: {
  terminacion: Date | null;
  tipoContrato: string;
  terminadoAnticipadamente: boolean;
  liquidado: boolean;
  hoy?: Date;
}): { fase: FaseLiquidacion; limite: Date | null; dias: number } {
  if (!requiereLiquidacion(datos.tipoContrato, datos.terminadoAnticipadamente)) return { fase: "no-requiere", limite: null, dias: 0 };
  if (datos.liquidado) return { fase: "liquidado", limite: null, dias: 0 };
  const hoy = datos.hoy ?? new Date();
  if (!datos.terminacion || datos.terminacion >= hoy) return { fase: "en-ejecucion", limite: null, dias: 0 };
  const p = plazosLiquidacion(datos.terminacion);
  const dias = (limite: Date) => Math.ceil((limite.getTime() - hoy.getTime()) / MS_DIA);
  if (hoy <= p.mutuoAcuerdo) return { fase: "mutuo-acuerdo", limite: p.mutuoAcuerdo, dias: dias(p.mutuoAcuerdo) };
  if (hoy <= p.unilateral) return { fase: "unilateral", limite: p.unilateral, dias: dias(p.unilateral) };
  if (hoy <= p.residual) return { fase: "residual", limite: p.residual, dias: dias(p.residual) };
  return { fase: "sin-competencia", limite: p.residual, dias: dias(p.residual) };
}
