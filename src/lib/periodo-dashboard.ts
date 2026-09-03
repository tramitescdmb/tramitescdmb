/**
 * Período seleccionable en los dashboards (Trámites ambientales 2.0, VITAL,
 * SINCA 1.0 y Minería de datos): por defecto Total (todo el histórico, sin
 * filtro) o un rango con calendario (?desde=&hasta=). Mínimo un mes — un
 * rango más corto se estira automáticamente para cumplirlo.
 */
export type RangoPeriodo = { desde: Date; hasta: Date } | null; // null = Total

export type FiltrosPeriodo = { desde?: string; hasta?: string };

const DIA_MS = 86_400_000;
const MIN_DIAS_PERSONALIZADO = 28; // "el mínimo período debe ser de un mes"

function parsearFechaLocal(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatoCorto(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function resolverPeriodo(sp: FiltrosPeriodo): { rango: RangoPeriodo; etiqueta: string } {
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
    };
  }

  return { rango: null, etiqueta: "Total (todo el histórico)" };
}
