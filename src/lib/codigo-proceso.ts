import { causalDe } from "@/lib/compatibilidad-modalidad";

const PREFIJO_MODALIDAD: Record<string, string> = {
  LICITACION_PUBLICA: "LP",
  SELECCION_ABREVIADA_MENOR_CUANTIA: "SA-MC",
  SELECCION_ABREVIADA_SUBASTA_INVERSA: "SA-SI",
  SELECCION_ABREVIADA_ENAJENACION_BIENES: "SA-EBE",
  SELECCION_ABREVIADA_LICITACION_DESIERTA: "SA-LPD",
  SELECCION_ABREVIADA_ACUERDO_MARCO: "SA-AMP",
  SELECCION_ABREVIADA_BOLSA_PRODUCTOS: "SA-BP",
  CONCURSO_MERITOS: "CM",
  MINIMA_CUANTIA: "MC",
  CONVENIO_ASOCIACION: "RE",
  ARRENDAMIENTO: "CD-A",
  OTRA: "OT",
};

export function prefijoProceso(modalidad: string, causal?: string | null): string | null {
  if (modalidad === "CONTRATACION_DIRECTA") return causalDe(causal)?.codigo ?? null;
  return PREFIJO_MODALIDAD[modalidad] ?? null;
}

export function formatearCodigoProceso(prefijo: string, numero: number, anio: number): string {
  return `${prefijo}-${String(numero).padStart(4, "0")}-${anio}`;
}

export function normalizarCodigoProceso(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export function errorCodigoProceso(codigo: string, modalidad: string, causal?: string | null): string | null {
  const prefijo = prefijoProceso(modalidad, causal);
  if (!prefijo) return "Indique la modalidad y, en contratación directa, la causal antes del código de proceso.";
  const patron = new RegExp(`^${prefijo.replace(/-/g, "\\-")}-\\d{4}-\\d{4}$`);
  if (!patron.test(codigo)) return `El código de proceso debe tener la forma ${prefijo}-0000-AAAA (Manual A-BS-MA01, num. 6.2).`;
  return null;
}

export function identificacionContrato(c: { codigoProceso?: string | null; numeroContrato?: string | null; numero: string }): string {
  const partes = [c.codigoProceso, c.numeroContrato ? `Contrato N.° ${c.numeroContrato}` : null].filter(Boolean);
  return partes.length ? partes.join(" · ") : c.numero;
}
