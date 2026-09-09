/**
 * Formato de fecha/hora en hora de Colombia (America/Bogota, UTC-5, sin horario de verano) — sin esto,
 * `toLocaleDateString`/`toLocaleString` usan la zona horaria del proceso que ejecuta el servidor (en
 * Vercel, UTC por defecto), no la de la CDMB. La diferencia importa de verdad: una radicación hecha a las
 * 7pm en Bucaramanga cae en el día calendario SIGUIENTE en UTC, lo que correría mal cualquier cálculo o
 * lectura de plazos legales (Ley 1437) basada en esa fecha.
 */
const ZONA_HORARIA = "America/Bogota";

export function formatearFecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: ZONA_HORARIA });
}

export function formatearFechaLarga(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: ZONA_HORARIA });
}

/**
 * Fecha-solo-día (columnas `@db.Date` o valores construidos como `YYYY-MM-DDT00:00:00Z`).
 * Se formatea en UTC a propósito: no llevan hora, y pasarlas por la zona Colombia
 * las correría al día anterior.
 */
export function formatearFechaSolo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatearFechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONA_HORARIA });
}

export function formatearFechaHoraLarga(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONA_HORARIA });
}

/** AAAA-MM-DD del día calendario en Colombia — para nombres de archivo de exportaciones (no usar
 * `toISOString().slice(0,10)`: eso da el día en UTC, que puede ir hasta 5 horas adelantado). */
export function fechaArchivoColombia(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}
