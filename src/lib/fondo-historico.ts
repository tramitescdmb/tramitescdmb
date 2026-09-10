/**
 * Fondo Documental histórico — ESPEJO DE SOLO CONSULTA.
 *
 * La CDMB tuvo antes de este SGDEA un sistema de gestión documental llamado
 * «psdocuments» (Tomcat/JSP, 2006-2023) y un sistema de radicación «SIC
 * correspondencia», los dos sobre un Oracle 10g en la intranet
 * (192.168.7.40, esquema `C`). Ese Oracle NO es alcanzable desde Vercel.
 *
 * En vez de migrar nada, se mantiene un espejo de **solo metadatos** en la
 * base del SGDEA: un job dentro de la red CDMB (scripts/fondo-historico/)
 * lee el Oracle y hace upsert vía `POST /api/fondo-historico/ingest`. Las
 * imágenes escaneadas (1,4 TB) NO se copian — se consultan en la red
 * corporativa. Ver memory/project_psdocuments_legacy.md.
 *
 * Este módulo: identidad de los fondos, tipos del payload de ingesta y
 * helpers de normalización. No toca la red ni el navegador.
 */

export const FONDOS = {
  psdocuments: {
    id: "psdocuments",
    nombre: "psdocuments",
    titulo: "Fondo psdocuments",
    descripcion:
      "Documentos escaneados del sistema de gestión documental anterior de la CDMB (2006–2023).",
  },
} as const;

export type FondoId = keyof typeof FONDOS;

export function esFondoValido(id: string): id is FondoId {
  return Object.prototype.hasOwnProperty.call(FONDOS, id);
}

/**
 * El módulo aparece en la navegación solo si hay un token de ingesta
 * configurado (lo comparte el job de la red CDMB y la ruta /ingest).
 */
export function fondoHistoricoConfigurado() {
  return !!process.env.FONDO_INGEST_TOKEN?.trim();
}

// --- Payload de ingesta ------------------------------------------------------

/** Una fila tal como la envía el extractor. Campos en snake para que el
 *  script Oracle los mapee 1:1 sin ceremonia. */
export interface FilaFondoEntrada {
  ref_id: string;
  serie_id?: number | null;
  serie_nombre?: string | null;
  oficina?: string | null;
  numero?: string | null;
  numero_entrada?: string | null;
  numero_salida?: string | null;
  fecha?: string | null; // ISO o "YYYY-MM-DD"
  fecha_entrada?: string | null;
  fecha_salida?: string | null;
  asunto?: string | null;
  razon_social?: string | null;
  destinatario?: string | null;
  firma?: string | null;
  estado?: string | null;
  ciclo?: string | null;
  tiene_imagen?: boolean | null;
  num_archivos?: number | null;
  ruta_original?: string | null;
  campos?: Record<string, unknown> | null;
}

export interface CuerpoIngesta {
  fondo: string;
  /** id de la corrida; la primera llamada lo omite y recibe uno nuevo. */
  sincronizacionId?: string;
  disparadoPor?: string;
  totalOrigen?: number;
  lote?: FilaFondoEntrada[];
  /** true en la última llamada: borra las filas del fondo no tocadas en esta corrida. */
  finalizar?: boolean;
}

// --- Normalización ----------------------------------------------------------

export function parseFechaFondo(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // "YYYY-MM-DD" o ISO. Oracle a veces entrega "DD/MM/YYYY".
  let d: Date | null = null;
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  else {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) d = new Date(t);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const anio = d.getFullYear();
  // psdocuments va de 2006 a 2023; se descartan años imposibles (typos de captura).
  if (anio < 1980 || anio > new Date().getFullYear() + 1) return null;
  return d;
}

function limpiar(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Convierte una fila del extractor en el shape de la tabla FondoDocumento. */
export function filaAModelo(fondo: string, fila: FilaFondoEntrada) {
  const fecha = parseFechaFondo(fila.fecha);
  return {
    id: `${fondo}:${fila.ref_id}`,
    fondo,
    refId: String(fila.ref_id),
    serieId: fila.serie_id ?? null,
    serieNombre: limpiar(fila.serie_nombre),
    oficina: limpiar(fila.oficina),
    numero: limpiar(fila.numero),
    numeroEntrada: limpiar(fila.numero_entrada),
    numeroSalida: limpiar(fila.numero_salida),
    fecha,
    anio: fecha ? fecha.getFullYear() : null,
    fechaEntrada: parseFechaFondo(fila.fecha_entrada),
    fechaSalida: parseFechaFondo(fila.fecha_salida),
    asunto: limpiar(fila.asunto),
    razonSocial: limpiar(fila.razon_social),
    destinatario: limpiar(fila.destinatario),
    firma: limpiar(fila.firma),
    estado: limpiar(fila.estado),
    ciclo: limpiar(fila.ciclo),
    tieneImagen: !!fila.tiene_imagen,
    numArchivos: fila.num_archivos ?? 0,
    rutaOriginal: limpiar(fila.ruta_original),
    campos: (fila.campos ?? {}) as Record<string, unknown>,
  };
}

export const AVISO_IMAGEN =
  "El documento escaneado no se copia a este sistema. Su consulta está disponible únicamente desde la red corporativa de la CDMB, a través de Gestión Documental.";
