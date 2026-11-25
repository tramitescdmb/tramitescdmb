/**
 * Fecha de radicación de una solicitud de VITAL.
 *
 * `wsObtenerSolicitudes` no siempre la entrega: para varias solicitudes (también en
 * SINCA) la columna llega vacía aunque el portal de VITAL sí muestra la fecha de
 * creación. Por eso se toma el mejor dato disponible, en este orden:
 *   1. la fecha que trae la lista de VITAL (con cualquiera de sus nombres);
 *   2. una fecha del formulario del trámite (campo «fecha de radicación / creación / solicitud»);
 * El nombre de los anexos NO se usa: no es un dato confiable de la fecha.
 */

export type OrigenFechaVital = "vital" | "formulario";

export const ETIQUETA_ORIGEN_FECHA_VITAL: Record<OrigenFechaVital, string> = {
  vital: "",
  formulario: "según el formulario de VITAL",
};

const CLAVES_FECHA_LISTADO = [
  "fechaRadicacion",
  "FechaRadicacion",
  "fecha_radicacion",
  "FECHA_RADICACION",
  "fechaCreacion",
  "FechaCreacion",
  "fecha_creacion",
  "FECHA_CREACION",
  "fechaSolicitud",
  "FechaSolicitud",
  "fecha_solicitud",
];

const anioValido = (y: number) => y >= 2000 && y <= 2100;

/** Medianoche (sin hora) se guarda como fecha de calendario a las 00:00 UTC; con hora, como hora de Bogotá. */
function armar(y: number, m: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (!anioValido(y) || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  // Descarta fechas imposibles como 31 de febrero.
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d) return null;
  return h === 0 && mi === 0 && s === 0 ? new Date(Date.UTC(y, m - 1, d)) : new Date(Date.UTC(y, m - 1, d, h + 5, mi, s));
}

/** Convierte el valor de fecha que entrega VITAL. Devuelve null si no es una fecha. */
export function parsearFechaVital(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const f = new Date(v);
    return Number.isNaN(f.getTime()) || !anioValido(f.getUTCFullYear()) ? null : f;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s === "-2147483648") return null;

  // /Date(1763337600000)/ (JSON de .NET)
  const net = s.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/);
  if (net) return parsearFechaVital(Number(net[1]));

  // ISO con zona explícita: se respeta tal cual.
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const f = new Date(s);
    return Number.isNaN(f.getTime()) || !anioValido(f.getUTCFullYear()) ? null : f;
  }

  // 2026-11-17, 2026-11-17 00:00:00, 2026-11-17T03:38:42(.000)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  if (iso) return armar(+iso[1], +iso[2], +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));

  // 17/11/2026 o 17-11-2026, con hora opcional
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) return armar(+dmy[3], +dmy[2], +dmy[1], +(dmy[4] ?? 0), +(dmy[5] ?? 0), +(dmy[6] ?? 0));

  return null;
}

/** Fecha que viene en una fila de `wsObtenerSolicitudes`, con cualquiera de los nombres conocidos. */
export function fechaDeFilaListado(fila: Record<string, unknown>): Date | null {
  for (const k of CLAVES_FECHA_LISTADO) {
    const f = parsearFechaVital(fila[k]);
    if (f) return f;
  }
  // Cualquier otra clave «fecha…radic/creac/solicit».
  for (const [k, v] of Object.entries(fila)) {
    if (/fecha/i.test(k) && /radic|creac|solicit/i.test(k)) {
      const f = parsearFechaVital(v);
      if (f) return f;
    }
  }
  return null;
}

/**
 * Busca la «fecha de creación» (o de radicación / solicitud) entre los datos que VITAL
 * entrega fuera del formulario: lo que responden wsSolicitudes (sin el formulario) y
 * wsSolicitante. El portal de VITAL la muestra como «Fecha de creación». Orden de
 * preferencia: creación, radicación, solicitud.
 */
export function fechaDeRespuestaVital(respuesta: unknown): Date | null {
  const prioridad = (clave: string): number => {
    const k = clave.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!k.includes("fecha")) return -1;
    if (/creac/.test(k)) return 0;
    if (/radic/.test(k)) return 1;
    if (/solicit/.test(k)) return 2;
    return -1;
  };
  let mejor: { p: number; f: Date } | null = null;
  const recorrer = (v: unknown, prof: number) => {
    if (prof > 3 || v == null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) recorrer(x, prof + 1);
      return;
    }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = prioridad(k);
      if (p >= 0) {
        const f = parsearFechaVital(x);
        if (f && (!mejor || p < mejor.p)) mejor = { p, f };
      } else {
        recorrer(x, prof + 1);
      }
    }
  };
  recorrer(respuesta, 0);
  return (mejor as { p: number; f: Date } | null)?.f ?? null;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Fecha de radicación / creación / solicitud escrita en el formulario del trámite. */
export function fechaDeCamposVital(campos: unknown): Date | null {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) return null;
  for (const [k, v] of Object.entries(campos as Record<string, unknown>)) {
    const clave = sinTildes(k);
    if (clave.includes("fecha") && /radic|creac|solicit|presenta/.test(clave)) {
      const f = parsearFechaVital(typeof v === "object" && v && "value" in v ? (v as { value: unknown }).value : v);
      if (f) return f;
    }
  }
  return null;
}

export function mejorFechaRadicacionVital(fuentes: {
  listado?: Date | null;
  /** «Fecha de creación» que VITAL entrega en wsSolicitudes / wsSolicitante. */
  respuesta?: Date | null;
  campos?: unknown;
}): { fecha: Date; origen: OrigenFechaVital } | null {
  if (fuentes.listado) return { fecha: fuentes.listado, origen: "vital" };
  if (fuentes.respuesta) return { fecha: fuentes.respuesta, origen: "vital" };
  const deCampos = fechaDeCamposVital(fuentes.campos);
  if (deCampos) return { fecha: deCampos, origen: "formulario" };
  return null;
}
