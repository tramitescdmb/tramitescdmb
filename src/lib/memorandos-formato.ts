/**
 * Formato del memorando institucional (modelo: memorando ADEI – 054 /2026): número por oficina y año,
 * ciudad y fecha, PARA / DE con nombre y cargo, asunto, cuerpo, firma y cuadro Proyectó / Revisó /
 * Oficina responsable. Funciones puras: sin base de datos, para poder probarlas.
 */

export type PersonaMemorando = { nombre: string; cargo: string };

/**
 * Envío masivo: a todos los funcionarios de planta, a todos los contratistas o a todos. Llega como
 * notificación en la plataforma (campana y bandeja «Sin leer»), no por correo. Cada persona queda con
 * su propia entrega y su fecha de lectura (Distribucion).
 */
export type GrupoMasivoMemorando = "PLANTA" | "CONTRATISTAS" | "TODOS";

export const GRUPOS_MASIVOS_MEMORANDO: Record<GrupoMasivoMemorando, { etiqueta: string; para: string }> = {
  PLANTA: { etiqueta: "Todos los funcionarios de planta", para: "FUNCIONARIOS DE PLANTA DE LA CDMB" },
  CONTRATISTAS: { etiqueta: "Todos los contratistas", para: "CONTRATISTAS DE LA CDMB" },
  TODOS: { etiqueta: "Todos (funcionarios de planta y contratistas)", para: "FUNCIONARIOS Y CONTRATISTAS DE LA CDMB" },
};

export function esGrupoMasivo(v: unknown): v is GrupoMasivoMemorando {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(GRUPOS_MASIVOS_MEMORANDO, v);
}

export type DatosMemorando = {
  version: 1;
  consecutivo: number;
  numero: string;
  ciudad: string;
  para: PersonaMemorando;
  de: PersonaMemorando;
  proyecto: PersonaMemorando | null;
  reviso: PersonaMemorando | null;
  oficina: string;
  /** Solo en envíos masivos: a qué grupo se dirigió y a cuántas personas se entregó al firmarlo. */
  masivo?: { grupo: GrupoMasivoMemorando; total: number } | null;
  /**
   * Entrega: si lleva firmas de proyectó / revisó, queda retenido hasta la última firma (ver
   * memorandos-envio.ts). El plazo de respuesta se cuenta desde la entrega.
   */
  envio?: { retenido: boolean; plazoRespuestaDias: number | null; liberadoEn: string | null } | null;
};

export const CIUDAD_MEMORANDO = "Bucaramanga";

/**
 * Sigla de la oficina para el número del memorando. Los nombres de las dependencias terminan en su
 * sigla («Oficina Asesora de Direccionamiento Estratégico Institucional - ADEI», «… - SEYCA - Grupo …»):
 * se toma la última parte en mayúsculas. Si no hay, se usa el código de la dependencia.
 */
export function siglaDependencia(nombre: string | null | undefined, codigo: string | null | undefined): string {
  const partes = (nombre ?? "").split(/\s+-\s+/).map((p) => p.trim());
  const siglas = partes.filter((p) => /^[A-ZÁÉÍÓÚÑ]{2,10}$/.test(p));
  if (siglas.length) return siglas[siglas.length - 1]!;
  if (/^direcci[oó]n general$/i.test((nombre ?? "").trim())) return "DG";
  return (codigo ?? "").trim() || "MEMO";
}

export function formatearNumeroMemorando(sigla: string, consecutivo: number, anio: number): string {
  return `${sigla} – ${String(consecutivo).padStart(3, "0")} /${anio}`;
}

export function serieConsecutivoMemorando(codigoDependencia: string): string {
  return `MEMO-${codigoDependencia}`;
}

function persona(v: unknown): PersonaMemorando | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const nombre = typeof o.nombre === "string" ? o.nombre.trim() : "";
  const cargo = typeof o.cargo === "string" ? o.cargo.trim() : "";
  return nombre ? { nombre, cargo } : null;
}

function leerMasivo(v: unknown): DatosMemorando["masivo"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return esGrupoMasivo(o.grupo) ? { grupo: o.grupo, total: Math.max(0, Math.floor(Number(o.total) || 0)) } : null;
}

/** Lee lo guardado en Comunicacion.datosMemorando. Devuelve null si no es un memorando del formato nuevo. */
export function leerDatosMemorando(v: unknown): DatosMemorando | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const para = persona(o.para);
  const de = persona(o.de);
  if (!para || !de || typeof o.numero !== "string") return null;
  return {
    version: 1,
    consecutivo: Number(o.consecutivo) || 0,
    numero: o.numero,
    ciudad: typeof o.ciudad === "string" && o.ciudad.trim() ? o.ciudad.trim() : CIUDAD_MEMORANDO,
    para,
    de,
    proyecto: persona(o.proyecto),
    reviso: persona(o.reviso),
    oficina: typeof o.oficina === "string" ? o.oficina : "",
    masivo: leerMasivo(o.masivo),
  };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «5 de febrero de 2026», en hora de Colombia. */
export function fechaLargaMemorando(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(fecha);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return `${v("day")} de ${MESES[v("month") - 1]} de ${v("year")}`;
}

/**
 * Cuerpo del memorando. Se escribe como texto (es lo que queda firmado) con dos marcas sencillas:
 * **texto** para negrilla, y filas que empiezan y terminan en «|» para una tabla (la primera fila es el
 * encabezado). Un renglón en blanco separa párrafos.
 */
export type BloqueCuerpo = { tipo: "parrafo"; lineas: SegmentoTexto[][] } | { tipo: "tabla"; filas: SegmentoTexto[][][] };
export type SegmentoTexto = { texto: string; negrilla: boolean };

export function segmentosTexto(linea: string): SegmentoTexto[] {
  const out: SegmentoTexto[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let ultimo = 0;
  for (let m = re.exec(linea); m; m = re.exec(linea)) {
    if (m.index > ultimo) out.push({ texto: linea.slice(ultimo, m.index), negrilla: false });
    out.push({ texto: m[1]!, negrilla: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linea.length) out.push({ texto: linea.slice(ultimo), negrilla: false });
  return out;
}

const esFilaTabla = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const esSeparadorTabla = (l: string) => /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(l);

export function bloquesCuerpo(texto: string): BloqueCuerpo[] {
  const lineas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const bloques: BloqueCuerpo[] = [];
  let parrafo: string[] = [];
  let tabla: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", lineas: parrafo.map(segmentosTexto) });
    parrafo = [];
  };
  const cerrarTabla = () => {
    const filas = tabla.filter((l) => !esSeparadorTabla(l));
    if (filas.length) {
      bloques.push({
        tipo: "tabla",
        filas: filas.map((l) => l.trim().slice(1, -1).split("|").map((c) => segmentosTexto(c.trim()))),
      });
    }
    tabla = [];
  };
  for (const l of lineas) {
    if (esFilaTabla(l)) {
      cerrarParrafo();
      tabla.push(l);
    } else if (!l.trim()) {
      cerrarParrafo();
      cerrarTabla();
    } else {
      cerrarTabla();
      parrafo.push(l);
    }
  }
  cerrarParrafo();
  cerrarTabla();
  return bloques;
}

type SerieTrd = { id: string; nombre: string; dependenciaId?: string | null; subseries: { id: string; nombre: string }[] };

function sinTildes(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Clasificación TRD sugerida para un memorando, siempre dentro de la TRD de la oficina que lo envía:
 * primero una subserie «Memorandos»; si no hay, «Comunicaciones (oficiales) internas»; si no, una
 * subserie interna de una serie de comunicaciones. Devuelve null si la oficina no tiene ninguna.
 */
export function trdSugeridaMemorando(series: SerieTrd[], dependenciaId: string | null | undefined): { serieId: string; subserieId: string } | null {
  if (!dependenciaId) return null;
  const propias = series.filter((s) => s.dependenciaId === dependenciaId);
  const reglas: ((serie: string, subserie: string) => boolean)[] = [
    (_s, ss) => /memorand/.test(ss),
    (_s, ss) => /comunicacion(es)?\s+(oficiales\s+)?internas?/.test(ss),
    (s) => /memorand/.test(s),
    (s, ss) => /comunicacion/.test(s) && /intern/.test(ss),
  ];
  for (const regla of reglas) {
    for (const s of propias) {
      const ss = s.subseries.find((x) => regla(sinTildes(s.nombre), sinTildes(x.nombre)));
      if (ss) return { serieId: s.id, subserieId: ss.id };
    }
  }
  return null;
}
