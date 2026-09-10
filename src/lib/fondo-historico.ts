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

function limpiar(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Nombres de columna de C.PSIDEAW_<serie> / C.COR_* que alimentan cada campo
 * normalizado. Se resuelve contra `campos` (que el extractor envía tal cual),
 * así los dos extractores —Node y sqlplus— solo mandan las columnas crudas y
 * el mapeo vive en un único lugar. El primero que exista y no esté vacío gana.
 */
const MAPA_COLUMNAS: Record<string, string[]> = {
  numero: ["NUMERO", "NUMENTRADA", "NUMERADI_REC", "NUMERO_ATC", "NRO", "NUMERODOC", "CONSECUTIVO"],
  numeroEntrada: ["NUMENTRADA", "NUMERADI_REC", "RADENT_ATC"],
  numeroSalida: ["NUMSALIDA"],
  fecha: ["FECHA", "FECHAENTRADA", "FECHRECEP_REC", "FECING_ATC", "FECHA_DOCUMENTO", "FECHADOC", "FECHASALIDA"],
  fechaEntrada: ["FECHAENTRADA", "FECHRECEP_REC"],
  fechaSalida: ["FECHASALIDA"],
  asunto: ["ASUNTO", "ASUNTO_REC", "ASUNTO_ATC", "OBJETO", "OBSERVACIONES"],
  razonSocial: ["RAZONSOCIAL", "RAZON_SOCIAL", "EMPRESAR_REC", "NOMBREREM_REC", "NOMSOL_ATC"],
  destinatario: ["DESTINATARIO"],
  oficina: ["DEPENDENCIA", "SUBDIRECCION", "SUBDIRECCION_REC", "OFICINA", "NOMOFI_ATC"],
  firma: ["FIRMA"],
  estado: ["DOC_ESTADO", "ESTADO_REC", "ESTADO_ATC"],
  ciclo: ["DOC_CICLO"],
};

function elegir(campos: Record<string, unknown>, nombres: string[]): string | null {
  for (const n of nombres) {
    const v = limpiar(campos[n]);
    if (v) return v;
  }
  return null;
}

/** Convierte una fila del extractor en el shape de la tabla FondoDocumento.
 *  Los campos normalizados se toman del propio `fila.*` si vienen, o se
 *  derivan de `campos` con MAPA_COLUMNAS. */
export function filaAModelo(fondo: string, fila: FilaFondoEntrada) {
  const campos = (fila.campos ?? {}) as Record<string, unknown>;
  const de = (k: keyof typeof MAPA_COLUMNAS, explicito: string | null | undefined) =>
    limpiar(explicito) ?? elegir(campos, MAPA_COLUMNAS[k]!);

  const fecha = parseFechaFondo(de("fecha", fila.fecha));
  return {
    id: `${fondo}:${fila.ref_id}`,
    fondo,
    refId: String(fila.ref_id),
    serieId: fila.serie_id ?? null,
    serieNombre: limpiar(fila.serie_nombre),
    oficina: de("oficina", fila.oficina),
    numero: de("numero", fila.numero),
    numeroEntrada: de("numeroEntrada", fila.numero_entrada),
    numeroSalida: de("numeroSalida", fila.numero_salida),
    fecha,
    anio: fecha ? fecha.getFullYear() : null,
    fechaEntrada: parseFechaFondo(de("fechaEntrada", fila.fecha_entrada)),
    fechaSalida: parseFechaFondo(de("fechaSalida", fila.fecha_salida)),
    asunto: de("asunto", fila.asunto),
    razonSocial: de("razonSocial", fila.razon_social),
    destinatario: de("destinatario", fila.destinatario),
    firma: de("firma", fila.firma),
    estado: de("estado", fila.estado),
    ciclo: de("ciclo", fila.ciclo),
    tieneImagen: !!fila.tiene_imagen,
    numArchivos: fila.num_archivos ?? 0,
    rutaOriginal: limpiar(fila.ruta_original),
    campos,
  };
}

export const AVISO_IMAGEN =
  "El documento escaneado no se copia a este sistema (son ~1,4 TB). El enlace de abajo abre el archivo original en el servidor de Gestión Documental y solo funciona desde la red corporativa de la CDMB.";

/**
 * Base HTTP de los escaneados de psdocuments en la intranet. La app original
 * (psdocuments/WEB-INF/web.xml) mapea la unidad `z:` a `rutaWeb` =
 * http://192.168.7.70:80/gestion (Apache en patevaca). Solo resuelve dentro
 * de la red CDMB. Sobreescribible por si cambia el servidor.
 */
export const PSDOCUMENTS_BASE_INTRANET =
  process.env.FONDO_PSDOCUMENTS_BASE?.trim().replace(/\/+$/, "") || "http://192.168.7.70/gestion";

/**
 * Convierte `VER_CAMINO||VER_ARCHIVO` (p. ej. `z:\Documentos\00000262\OGALVIS\00694338.pdf`
 * o `z:/Documentos/...`) en la URL de intranet del archivo. Devuelve null si no
 * tiene la forma esperada.
 */
export function urlIntranetPsdocuments(rutaOriginal: string | null | undefined): string | null {
  if (!rutaOriginal) return null;
  const m = rutaOriginal.trim().match(/^[a-zA-Z]:[\\/]+(.+)$/);
  if (!m) return null;
  const rel = m[1]!.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${PSDOCUMENTS_BASE_INTRANET}/${rel}`;
}
