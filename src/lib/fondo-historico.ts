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
      "Documentos escaneados del sistema de gestión documental anterior de la CDMB (2006–2010, ventana de 5 años).",
  },
  "sic-pqr": {
    id: "sic-pqr",
    nombre: "SIC — PQR",
    titulo: "Fondo SIC — PQR",
    descripcion:
      "Peticiones, quejas y reclamos del sistema de correspondencia SIC (COR_ATCREG), aún en uso — últimos 5 años, sincronizado a diario.",
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

/** Columnas que ya alimentan un campo normalizado — no vale la pena repetirlas
 *  en `campos` (Supabase Free tiene 500 MB). */
const COLUMNAS_MAPEADAS = new Set(Object.values(MAPA_COLUMNAS).flat());
const MAX_VALOR_CAMPO = 120;
const MAX_ASUNTO = 300;

/** Deja en `campos` solo lo que NO quedó en un campo normalizado, con cada
 *  valor recortado. Devuelve null si no sobra nada. */
function camposResiduales(campos: Record<string, unknown>): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    if (COLUMNAS_MAPEADAS.has(k) || k === "DOC_IDDOCUM") continue;
    const s = limpiar(v);
    if (!s) continue;
    out[k] = s.length > MAX_VALOR_CAMPO ? s.slice(0, MAX_VALOR_CAMPO) + "…" : s;
  }
  return Object.keys(out).length ? out : null;
}

/** Convierte una fila del extractor en el shape de la tabla FondoDocumento.
 *  Los campos normalizados se toman del propio `fila.*` si vienen, o se
 *  derivan de `campos` con MAPA_COLUMNAS. `campos` se guarda recortado. */
export function filaAModelo(fondo: string, fila: FilaFondoEntrada) {
  const campos = (fila.campos ?? {}) as Record<string, unknown>;
  const de = (k: keyof typeof MAPA_COLUMNAS, explicito: string | null | undefined) =>
    limpiar(explicito) ?? elegir(campos, MAPA_COLUMNAS[k]!);
  const recortar = (s: string | null, max: number) => (s && s.length > max ? s.slice(0, max) + "…" : s);

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
    asunto: recortar(de("asunto", fila.asunto), MAX_ASUNTO),
    razonSocial: recortar(de("razonSocial", fila.razon_social), 200),
    destinatario: recortar(de("destinatario", fila.destinatario), 200),
    firma: de("firma", fila.firma),
    estado: de("estado", fila.estado),
    ciclo: de("ciclo", fila.ciclo),
    tieneImagen: !!fila.tiene_imagen,
    numArchivos: fila.num_archivos ?? 0,
    rutaOriginal: limpiar(fila.ruta_original),
    campos: camposResiduales(campos),
  };
}

/**
 * Parsea el "dump" de sqlplus (Oracle 10g no puede generar JSON sin romperlo)
 * a filas. Marcas por línea:
 *   #<ref_id>    nuevo documento
 *   @<COLUMNA>   empieza un campo
 *   =<trozo>     (0..n) contenido del campo, en trozos de ≤200 chars
 * Columnas especiales: `__NARCH__` → num_archivos, `__RUTA__` → ruta_original.
 */
export function parseDumpFondo(
  texto: string,
  serieId: number | null,
  serieNombre: string,
): FilaFondoEntrada[] {
  const filas: FilaFondoEntrada[] = [];
  let cur: FilaFondoEntrada | null = null;
  let campos: Record<string, unknown> = {};
  let campo: string | null = null;
  let valor: string[] = [];

  const cerrarCampo = () => {
    if (cur && campo != null) {
      const v = valor.join("");
      if (campo === "__NARCH__") cur.num_archivos = Number(v) || 0;
      else if (campo === "__RUTA__") cur.ruta_original = v.trim() || null;
      else if (v.trim() !== "") campos[campo] = v;
    }
    campo = null;
    valor = [];
  };
  const cerrarFila = () => {
    if (cur) {
      cerrarCampo();
      cur.campos = campos;
      cur.tiene_imagen = (cur.num_archivos ?? 0) > 0;
      filas.push(cur);
    }
    cur = null;
    campos = {};
    campo = null;
    valor = [];
  };

  for (const linea of texto.split(/\r?\n/)) {
    if (linea.startsWith("#")) {
      cerrarFila();
      cur = { ref_id: linea.slice(1).trim(), serie_id: serieId, serie_nombre: serieNombre };
    } else if (linea.startsWith("@")) {
      cerrarCampo();
      campo = linea.slice(1).trim();
    } else if (linea.startsWith("=")) {
      valor.push(linea.slice(1));
    }
  }
  cerrarFila();
  return filas.filter((f) => f.ref_id !== "");
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
 * Conversor TIFF→PDF instalado en patevaca (scripts/fondo-historico/verdoc.cgi).
 * Si está configurado, el Fondo histórico abre los escaneados como PDF en el
 * navegador; si no, enlaza al archivo `.001` crudo (que el navegador descarga).
 * Ej.: `http://192.168.7.70/cgi-bin/verdoc`.
 */
export const PSDOCUMENTS_VISOR =
  process.env.FONDO_PSDOCUMENTS_VISOR?.trim().replace(/\/+$/, "") || null;

/**
 * Ruta relativa del archivo a partir de `VER_CAMINO||VER_ARCHIVO`
 * (`z:\Documentos\00000262\OGALVIS\00694338.pdf` → `Documentos/00000262/OGALVIS/00694338.pdf`).
 * Réplica de lo que hace verImagen.jsp: `\`→`/`, quitar la unidad, colapsar `//`.
 */
function rutaRelativaPsdocuments(rutaOriginal: string | null | undefined): string | null {
  if (!rutaOriginal) return null;
  const m = rutaOriginal.trim().replace(/\\/g, "/").match(/^[a-zA-Z]:\/*(.+)$/);
  if (!m) return null;
  return m[1]!.replace(/\/{2,}/g, "/").replace(/^\/+/, "");
}

/** URL para abrir/descargar el escaneado desde la red corporativa. Usa el
 *  conversor si está configurado; si no, el archivo crudo. */
export function urlIntranetPsdocuments(rutaOriginal: string | null | undefined): string | null {
  const rel = rutaRelativaPsdocuments(rutaOriginal);
  if (!rel) return null;
  if (PSDOCUMENTS_VISOR) return `${PSDOCUMENTS_VISOR}?f=${encodeURIComponent(rel)}`;
  return `${PSDOCUMENTS_BASE_INTRANET}/${rel}`;
}

/** true cuando el enlace pasa por el conversor (abre como PDF en el navegador). */
export function tieneVisorPsdocuments(): boolean {
  return PSDOCUMENTS_VISOR !== null;
}

/**
 * Repositorio de escaneos del SIC correspondencia — un FreeNAS aparte de
 * psdocuments, sin columna en Oracle: la ruta se arma por CONVENCIÓN a partir
 * del número y año del radicado. Confirmado a mano con ejemplos reales:
 *   entrada: http://192.168.7.53/ui/ADMINISTRADOR/in/<año>/Rad<número>-<año>.pdf
 *   salida:  http://<host>/ui/ADMINISTRADOR/out/ESCANEO_CORRESPONDENCIA_ENVIADA/<año>/<mes de 2 dígitos>/<número>.pdf
 * Solo se implementa "entrada" (lo que cubre el fondo `sic-pqr`, vía
 * RADENT_ATC/ANHORAD_ATC — el radicado de entrada de cada PQR). No hay forma
 * de confirmar por Oracle si el escaneo existe para un radicado puntual: el
 * enlace se ofrece igual, puede dar 404 si esa entrada no se escaneó.
 */
export const SIC_BASE_INTRANET =
  process.env.FONDO_SIC_BASE?.trim().replace(/\/+$/, "") || "http://192.168.7.53";

export function urlIntranetSicEntrada(
  numeroRadicado: string | null | undefined,
  anio: string | number | null | undefined,
): string | null {
  const n = numeroRadicado ? String(numeroRadicado).trim() : "";
  const a = anio ? String(anio).trim() : "";
  if (!n || !a || !/^\d+$/.test(a)) return null;
  return `${SIC_BASE_INTRANET}/ui/ADMINISTRADOR/in/${a}/Rad${n}-${a}.pdf`;
}
