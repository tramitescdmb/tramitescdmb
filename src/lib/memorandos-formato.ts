/**
 * Formato del memorando institucional (modelo: memorando ADEI – 054 /2026): número por oficina y año,
 * ciudad y fecha, PARA / DE con nombre y cargo, asunto, cuerpo, firma y cuadro Proyectó / Revisó /
 * Oficina responsable. Funciones puras: sin base de datos, para poder probarlas.
 */

export type PersonaMemorando = { nombre: string; cargo: string };

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
