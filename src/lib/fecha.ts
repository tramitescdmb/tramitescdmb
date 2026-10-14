const ZONA_HORARIA = "America/Bogota";

export function esSoloFecha(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

export function zonaDeFecha(d: Date): string {
  return esSoloFecha(d) ? "UTC" : ZONA_HORARIA;
}

export function formatearFecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const f = new Date(d);
  return f.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: zonaDeFecha(f) });
}

export function formatearFechaCalendario(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatearFechaLarga(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const f = new Date(d);
  return f.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: zonaDeFecha(f) });
}

export function formatearFechaSolo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatearFechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  if (esSoloFecha(new Date(d))) return formatearFecha(d);
  return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONA_HORARIA });
}

export function formatearFechaHoraLarga(d: Date | string | null | undefined): string {
  if (!d) return "—";
  if (esSoloFecha(new Date(d))) return formatearFechaLarga(d);
  return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONA_HORARIA });
}

export function fechaArchivoColombia(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}
