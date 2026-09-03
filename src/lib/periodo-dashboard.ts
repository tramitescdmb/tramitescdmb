/**
 * Período seleccionable en los dashboards (Trámites ambientales 2.0, VITAL,
 * SINCA 1.0 y Minería de datos): "Total" (por defecto, todo el histórico —
 * el comportamiento de siempre, sin filtro) o una ventana de tiempo, ya sea
 * un atajo (último mes/año/2 años/4 años) o un rango personalizado con
 * calendario. El mínimo period o personalizado es de un mes — un rango más
 * corto se estira automáticamente para cumplirlo.
 */
export type RangoPeriodo = { desde: Date; hasta: Date } | null; // null = Total

export type FiltrosPeriodo = { periodo?: string; desde?: string; hasta?: string };

const DIA_MS = 86_400_000;
const MIN_DIAS_PERSONALIZADO = 28; // "el mínimo período debe ser de un mes"

const ATAJOS: Record<string, { meses: number; etiqueta: string }> = {
  "1m": { meses: 1, etiqueta: "Último mes" },
  "3m": { meses: 3, etiqueta: "Últimos 3 meses" },
  "6m": { meses: 6, etiqueta: "Últimos 6 meses" },
  "1a": { meses: 12, etiqueta: "Último año" },
  "2a": { meses: 24, etiqueta: "Últimos 2 años" },
  "4a": { meses: 48, etiqueta: "Últimos 4 años" },
};

function inicioHoyUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function restarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
}

function parsearFechaLocal(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatoCorto(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function resolverPeriodo(sp: FiltrosPeriodo): { rango: RangoPeriodo; etiqueta: string; valor: string } {
  const hoyExclusivo = new Date(inicioHoyUTC().getTime() + DIA_MS); // incluye el día de hoy completo

  if (sp.periodo === "personalizado") {
    const desdeRaw = sp.desde ? parsearFechaLocal(sp.desde) : null;
    const hastaRaw = sp.hasta ? parsearFechaLocal(sp.hasta) : null;
    if (desdeRaw && hastaRaw && desdeRaw < hastaRaw) {
      // "hasta" es el último día INCLUIDO por el usuario — se corre un día para que el filtro (< hasta) lo cubra completo.
      let hasta = new Date(hastaRaw.getTime() + DIA_MS);
      if (hasta.getTime() - desdeRaw.getTime() < MIN_DIAS_PERSONALIZADO * DIA_MS) {
        hasta = new Date(desdeRaw.getTime() + MIN_DIAS_PERSONALIZADO * DIA_MS);
      }
      return {
        rango: { desde: desdeRaw, hasta },
        etiqueta: `${formatoCorto(desdeRaw)} – ${formatoCorto(new Date(hasta.getTime() - DIA_MS))}`,
        valor: "personalizado",
      };
    }
  }

  const atajo = sp.periodo ? ATAJOS[sp.periodo] : undefined;
  if (atajo) {
    return { rango: { desde: restarMeses(hoyExclusivo, atajo.meses), hasta: hoyExclusivo }, etiqueta: atajo.etiqueta, valor: sp.periodo! };
  }

  return { rango: null, etiqueta: "Total (todo el histórico)", valor: "total" };
}
