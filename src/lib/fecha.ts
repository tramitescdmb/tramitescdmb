const ZONA_HORARIA = "America/Bogota";

export function formatearFecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: ZONA_HORARIA });
}

export function formatearFechaLarga(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: ZONA_HORARIA });
}

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

export function fechaArchivoColombia(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}
