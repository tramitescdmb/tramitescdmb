export const TIPOS_CAMPO = {
  texto: "Texto corto",
  parrafo: "Texto largo",
  numero: "Número",
  fecha: "Fecha",
  seleccion: "Lista de opciones",
  si_no: "Sí / No",
  calculado: "Cálculo automático",
  coordenadas: "Coordenadas (GPS)",
  tabla: "Tabla",
  lista_chequeo: "Lista de chequeo (textos tipo)",
} as const;
export type TipoCampo = keyof typeof TIPOS_CAMPO;

export const TIPOS_COLUMNA = {
  texto: "Texto",
  numero: "Número",
  calculado: "Cálculo",
  cumplimiento: "Cumple / No cumple",
} as const;
export type TipoColumna = keyof typeof TIPOS_COLUMNA;

export const PRECARGAS = {
  expediente: "Número de expediente",
  tramite: "Tipo de trámite",
  solicitante: "Nombre del solicitante",
  identificacion: "Identificación del solicitante",
  telefono: "Teléfono del solicitante",
  correo: "Correo del solicitante",
  municipio: "Municipio",
  predio: "Nombre del predio",
  matricula: "Matrícula inmobiliaria",
  catastral: "Número catastral",
  direccion_predio: "Dirección del predio",
  area_predio: "Área del predio (ha)",
  funcionario: "Funcionario que realiza la visita",
  fecha_visita: "Fecha de la visita",
} as const;
export type ClavePrecarga = keyof typeof PRECARGAS;

export type ColumnaTabla = {
  id: string;
  titulo: string;
  tipo: TipoColumna;
  formula?: string;
  decimales?: number;
  total?: boolean;
  vacioComoCero?: boolean;
  limite?: string;
  resultado?: string;
};

export type ItemChequeo = { texto: string; marcado?: boolean };

export type Campo = {
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio?: boolean;
  ayuda?: string;
  precarga?: ClavePrecarga;
  plantilla?: string;
  opciones?: string[];
  unidad?: string;
  decimales?: number;
  formula?: string;
  columnas?: ColumnaTabla[];
  filasIniciales?: Record<string, string>[];
  agrupar?: { por: string[]; sumar: string[]; titulo?: string };
  items?: ItemChequeo[];
  conCota?: boolean;
};

export type Seccion = { id: string; titulo: string; campos: Campo[] };

export type EstructuraFormato = { secciones: Seccion[] };

export type ValorCoordenadas = { lat: number | null; lon: number | null; cota?: string; precisionM?: number | null };
export type ValorChequeo = { marcados: number[]; adicional?: string };
export type FilaTabla = Record<string, string>;
export type ValorCampo = string | FilaTabla[] | ValorCoordenadas | ValorChequeo;
export type Respuestas = Record<string, ValorCampo>;

export type DatosPrecarga = Partial<Record<ClavePrecarga, string>>;

export function numeroDesdeTexto(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/\s/g, "").replace(/^[<>≤≥]=?/, "");
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatearNumero(n: number | null | undefined, decimales = 2): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenizar(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j]!)) j++;
      const n = Number(expr.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`Número no válido: ${expr.slice(i, j)}`);
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_áéíóúñÁÉÍÓÚÑ]/.test(c)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_.áéíóúñÁÉÍÓÚÑ]/.test(expr[j]!)) j++;
      tokens.push({ t: "id", v: expr.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^(),;".includes(c)) {
      tokens.push({ t: "op", v: c === ";" ? "," : c });
      i++;
      continue;
    }
    throw new Error(`Carácter no permitido en la fórmula: «${c}»`);
  }
  return tokens;
}

const FUNCIONES: Record<string, (args: number[]) => number> = {
  raiz: (a) => Math.sqrt(a[0]!),
  sqrt: (a) => Math.sqrt(a[0]!),
  redondear: (a) => {
    const f = 10 ** (a[1] ?? 0);
    return Math.round(a[0]! * f) / f;
  },
  round: (a) => {
    const f = 10 ** (a[1] ?? 0);
    return Math.round(a[0]! * f) / f;
  },
  abs: (a) => Math.abs(a[0]!),
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
};

const CONSTANTES: Record<string, number> = { pi: Math.PI, PI: Math.PI };

export type Resolver = (id: string) => number | null;

class SinValor extends Error {}

export function evaluarFormula(expr: string, resolver: Resolver): number | null {
  const tokens = tokenizar(expr);
  let pos = 0;
  const ver = () => tokens[pos];
  const tomar = (v?: string) => {
    const tk = tokens[pos];
    if (!tk || (v !== undefined && !(tk.t === "op" && tk.v === v))) throw new Error(`Se esperaba «${v}» en la fórmula.`);
    pos++;
    return tk;
  };

  function primario(): number {
    const tk = ver();
    if (!tk) throw new Error("La fórmula está incompleta.");
    if (tk.t === "num") {
      pos++;
      return tk.v;
    }
    if (tk.t === "op" && tk.v === "(") {
      pos++;
      const v = suma();
      tomar(")");
      return v;
    }
    if (tk.t === "op" && tk.v === "-") {
      pos++;
      return -potencia();
    }
    if (tk.t === "id") {
      pos++;
      const sig = ver();
      if (sig && sig.t === "op" && sig.v === "(") {
        const fn = FUNCIONES[tk.v.toLowerCase()];
        if (!fn) throw new Error(`Función desconocida: ${tk.v}`);
        pos++;
        const args: number[] = [];
        if (!(ver()?.t === "op" && ver()?.v === ")")) {
          args.push(suma());
          while (ver()?.t === "op" && ver()?.v === ",") {
            pos++;
            args.push(suma());
          }
        }
        tomar(")");
        return fn(args);
      }
      if (tk.v in CONSTANTES) return CONSTANTES[tk.v]!;
      const v = resolver(tk.v);
      if (v == null) throw new SinValor();
      return v;
    }
    throw new Error(`Símbolo inesperado «${tk.v}» en la fórmula.`);
  }

  function potencia(): number {
    const base = primario();
    if (ver()?.t === "op" && ver()?.v === "^") {
      pos++;
      return base ** potencia();
    }
    return base;
  }

  function producto(): number {
    let v = potencia();
    while (ver()?.t === "op" && (ver()!.v === "*" || ver()!.v === "/")) {
      const op = tomar().v;
      const d = potencia();
      v = op === "*" ? v * d : v / d;
    }
    return v;
  }

  function suma(): number {
    let v = producto();
    while (ver()?.t === "op" && (ver()!.v === "+" || ver()!.v === "-")) {
      const op = tomar().v;
      const d = producto();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  }

  try {
    const r = suma();
    if (pos < tokens.length) throw new Error("La fórmula tiene símbolos de más.");
    return Number.isFinite(r) ? r : null;
  } catch (e) {
    if (e instanceof SinValor) return null;
    throw e;
  }
}

export function identificadoresDeFormula(expr: string): string[] {
  try {
    return tokenizar(expr)
      .filter((t, i, arr): t is { t: "id"; v: string } => t.t === "id" && !(arr[i + 1]?.t === "op" && arr[i + 1]?.v === "(") && !(t.v in CONSTANTES))
      .map((t) => t.v);
  } catch {
    return [];
  }
}

export function validarFormula(expr: string, idsValidos: Set<string>): string | null {
  if (!expr.trim()) return "La fórmula está vacía.";
  try {
    evaluarFormula(expr, () => 1);
  } catch (e) {
    return e instanceof Error ? e.message : "Fórmula no válida.";
  }
  const desconocidos = identificadoresDeFormula(expr).filter((id) => !idsValidos.has(id));
  return desconocidos.length ? `No existe el campo o la columna: ${desconocidos.join(", ")}.` : null;
}

function filaTieneDatos(fila: FilaTabla, columnas: ColumnaTabla[]): boolean {
  return columnas.some((c) => (c.tipo === "texto" || c.tipo === "numero") && (fila[c.id] ?? "").trim() !== "");
}

export function filasConDatos(campo: Campo, valor: ValorCampo | undefined): FilaTabla[] {
  if (!Array.isArray(valor)) return [];
  const cols = campo.columnas ?? [];
  return valor.filter((f) => filaTieneDatos(f, cols));
}

export function valorColumnaFila(campo: Campo, fila: FilaTabla, colId: string, profundidad = 0): number | null {
  const col = (campo.columnas ?? []).find((c) => c.id === colId);
  if (!col || profundidad > 20) return null;
  if (col.tipo === "calculado") {
    if (!col.formula) return null;
    try {
      return evaluarFormula(col.formula, (id) => valorColumnaFila(campo, fila, id, profundidad + 1));
    } catch {
      return null;
    }
  }
  const n = numeroDesdeTexto(fila[colId]);
  if (n == null && col.vacioComoCero && col.tipo === "numero") return 0;
  return n;
}

export function totalColumna(campo: Campo, valor: ValorCampo | undefined, colId: string): number | null {
  const filas = filasConDatos(campo, valor);
  let total = 0;
  let alguno = false;
  for (const f of filas) {
    const v = valorColumnaFila(campo, f, colId);
    if (v != null) {
      total += v;
      alguno = true;
    }
  }
  return alguno ? total : null;
}

export function camposPlanos(estructura: EstructuraFormato): Campo[] {
  return estructura.secciones.flatMap((s) => s.campos);
}

export function valorNumericoCampo(estructura: EstructuraFormato, respuestas: Respuestas, id: string, profundidad = 0): number | null {
  if (profundidad > 30) return null;
  const campos = camposPlanos(estructura);
  const punto = id.indexOf(".");
  if (punto > 0) {
    const tabla = campos.find((c) => c.id === id.slice(0, punto) && c.tipo === "tabla");
    if (!tabla) return null;
    const col = id.slice(punto + 1);
    if (col === "_filas") return filasConDatos(tabla, respuestas[tabla.id]).length;
    return totalColumna(tabla, respuestas[tabla.id], col);
  }
  const campo = campos.find((c) => c.id === id);
  if (!campo) return null;
  if (campo.tipo === "calculado") {
    if (!campo.formula) return null;
    try {
      return evaluarFormula(campo.formula, (ref) => valorNumericoCampo(estructura, respuestas, ref, profundidad + 1));
    } catch {
      return null;
    }
  }
  const v = respuestas[id];
  return typeof v === "string" ? numeroDesdeTexto(v) : null;
}

export function idsReferenciables(estructura: EstructuraFormato): Set<string> {
  const ids = new Set<string>();
  for (const c of camposPlanos(estructura)) {
    if (c.tipo === "numero" || c.tipo === "calculado") ids.add(c.id);
    if (c.tipo === "tabla") {
      ids.add(`${c.id}._filas`);
      for (const col of c.columnas ?? []) if (col.tipo === "numero" || col.tipo === "calculado") ids.add(`${c.id}.${col.id}`);
    }
  }
  return ids;
}

export type Cumplimiento = "CUMPLE" | "NO CUMPLE" | "NO APLICA";
export const OPCIONES_CUMPLIMIENTO: Cumplimiento[] = ["CUMPLE", "NO CUMPLE", "NO APLICA"];

function rangoDesdeTexto(s: string): { min: number | null; max: number | null } | null {
  const t = s.trim();
  if (!t) return null;
  const partes = t.split(/\s+a\s+|\s*[–—]\s*/i);
  if (partes.length === 2) {
    const a = numeroDesdeTexto(partes[0]);
    const b = numeroDesdeTexto(partes[1]);
    if (a != null && b != null) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const n = numeroDesdeTexto(t);
  return n == null ? null : { min: null, max: n };
}

export function evaluarCumplimiento(limite: string | undefined, resultado: string | undefined): Cumplimiento | null {
  const l = (limite ?? "").trim();
  const r = (resultado ?? "").trim();
  if (!r) return null;
  if (/an[aá]lisis\s+y\s+reporte|reportar/i.test(l)) return "CUMPLE";
  const lim = rangoDesdeTexto(l);
  if (!lim) return null;
  const res = rangoDesdeTexto(r);
  if (!res) return null;
  const valores = [res.min, res.max].filter((v): v is number => v != null);
  const ok = valores.every((v) => (lim.min == null || v >= lim.min) && (lim.max == null || v <= lim.max));
  return ok ? "CUMPLE" : "NO CUMPLE";
}

export function cumplimientoFila(campo: Campo, fila: FilaTabla, col: ColumnaTabla): Cumplimiento | null {
  const auto = col.limite && col.resultado ? evaluarCumplimiento(fila[col.limite], fila[col.resultado]) : null;
  if (auto) return auto;
  const manual = fila[col.id];
  return OPCIONES_CUMPLIMIENTO.find((o) => o === manual) ?? null;
}

export function formatearValorCampo(estructura: EstructuraFormato, respuestas: Respuestas, campo: Campo): string {
  const v = respuestas[campo.id];
  switch (campo.tipo) {
    case "calculado": {
      const n = valorNumericoCampo(estructura, respuestas, campo.id);
      return n == null ? "" : `${formatearNumero(n, campo.decimales ?? 2)}${campo.unidad ? ` ${campo.unidad}` : ""}`;
    }
    case "numero": {
      const n = typeof v === "string" ? numeroDesdeTexto(v) : null;
      if (n == null) return typeof v === "string" ? v : "";
      return `${formatearNumero(n, campo.decimales ?? decimalesDe(v as string))}${campo.unidad ? ` ${campo.unidad}` : ""}`;
    }
    case "fecha":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fechaLarga(v) : typeof v === "string" ? v : "";
    case "texto":
    case "parrafo":
    case "seleccion":
    case "si_no":
      return typeof v === "string" ? v : "";
    default:
      return "";
  }
}

function decimalesDe(s: string): number {
  const m = s.trim().match(/[.,](\d+)$/);
  if (!m) return 0;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s.trim())) return 0;
  return Math.min(m[1]!.length, 6);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function variablesDisponibles(estructura: EstructuraFormato): { clave: string; etiqueta: string }[] {
  const base = Object.entries(PRECARGAS).map(([clave, etiqueta]) => ({ clave, etiqueta }));
  const propias = camposPlanos(estructura)
    .filter((c) => ["texto", "numero", "calculado", "fecha", "seleccion", "si_no"].includes(c.tipo))
    .map((c) => ({ clave: c.id, etiqueta: c.etiqueta }));
  return [...base, ...propias.filter((p) => !(p.clave in PRECARGAS))];
}

export function resolverPlantilla(texto: string, estructura: EstructuraFormato, respuestas: Respuestas, precarga: DatosPrecarga): string {
  const campos = camposPlanos(estructura);
  return texto.replace(/\{([A-Za-z0-9_]+)\}/g, (completo, clave: string) => {
    const campo = campos.find((c) => c.id === clave);
    if (campo) {
      const v = formatearValorCampo(estructura, respuestas, campo);
      if (v) return v;
    }
    if (clave in PRECARGAS) {
      const v = precarga[clave as ClavePrecarga];
      if (v) return v;
    }
    return campo || clave in PRECARGAS ? `[${campo?.etiqueta ?? PRECARGAS[clave as ClavePrecarga]}]` : completo;
  });
}

export function respuestasIniciales(estructura: EstructuraFormato, precarga: DatosPrecarga): Respuestas {
  const r: Respuestas = {};
  for (const c of camposPlanos(estructura)) {
    if (c.precarga && precarga[c.precarga]) r[c.id] = precarga[c.precarga]!;
    if (c.tipo === "tabla") r[c.id] = (c.filasIniciales ?? []).map((f) => ({ ...f }));
    if (c.tipo === "lista_chequeo") r[c.id] = { marcados: (c.items ?? []).flatMap((it, i) => (it.marcado ? [i] : [])) };
    if (c.tipo === "coordenadas") r[c.id] = { lat: null, lon: null, cota: "" };
  }
  for (const c of camposPlanos(estructura)) {
    if (c.tipo === "parrafo" && c.plantilla && !r[c.id]) r[c.id] = resolverPlantilla(c.plantilla, estructura, r, precarga);
  }
  return r;
}

export function actualizarTextosTipo(estructura: EstructuraFormato, anteriores: Respuestas, nuevas: Respuestas, precarga: DatosPrecarga): Respuestas {
  const r = { ...nuevas };
  for (const c of camposPlanos(estructura)) {
    if (c.tipo !== "parrafo" || !c.plantilla || nuevas[c.id] !== anteriores[c.id]) continue;
    const previo = resolverPlantilla(c.plantilla, estructura, anteriores, precarga);
    if (anteriores[c.id] === previo || !anteriores[c.id]) r[c.id] = resolverPlantilla(c.plantilla, estructura, nuevas, precarga);
  }
  return r;
}

export function campoVacio(campo: Campo, v: ValorCampo | undefined): boolean {
  if (campo.tipo === "calculado") return false;
  if (campo.tipo === "tabla") return filasConDatos(campo, v).length === 0;
  if (campo.tipo === "coordenadas") {
    const c = v as ValorCoordenadas | undefined;
    return !c || c.lat == null || c.lon == null;
  }
  if (campo.tipo === "lista_chequeo") {
    const c = v as ValorChequeo | undefined;
    return !c || (c.marcados.length === 0 && !(c.adicional ?? "").trim());
  }
  return typeof v !== "string" || !v.trim();
}

export function camposObligatoriosFaltantes(estructura: EstructuraFormato, respuestas: Respuestas): string[] {
  return camposPlanos(estructura)
    .filter((c) => c.obligatorio && campoVacio(c, respuestas[c.id]))
    .map((c) => c.etiqueta);
}

const MAX_TEXTO = 20_000;

export function sanearRespuestas(estructura: EstructuraFormato, entrada: unknown): Respuestas {
  const crudo = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? (entrada as Record<string, unknown>) : {};
  const r: Respuestas = {};
  for (const c of camposPlanos(estructura)) {
    const v = crudo[c.id];
    if (c.tipo === "calculado" || v == null) continue;
    if (c.tipo === "tabla") {
      if (!Array.isArray(v)) continue;
      const cols = c.columnas ?? [];
      r[c.id] = v.slice(0, 300).map((fila) => {
        const f: FilaTabla = {};
        const origen = fila && typeof fila === "object" ? (fila as Record<string, unknown>) : {};
        for (const col of cols) {
          if (col.tipo === "calculado") continue;
          const x = origen[col.id];
          if (typeof x === "string" && x.trim()) f[col.id] = x.slice(0, 2_000);
        }
        return f;
      });
      continue;
    }
    if (c.tipo === "coordenadas") {
      const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
      const lat = typeof o.lat === "number" && Number.isFinite(o.lat) && Math.abs(o.lat) <= 90 ? o.lat : null;
      const lon = typeof o.lon === "number" && Number.isFinite(o.lon) && Math.abs(o.lon) <= 180 ? o.lon : null;
      const precisionM = typeof o.precisionM === "number" && Number.isFinite(o.precisionM) ? o.precisionM : null;
      r[c.id] = { lat, lon, cota: typeof o.cota === "string" ? o.cota.slice(0, 40) : "", precisionM };
      continue;
    }
    if (c.tipo === "lista_chequeo") {
      const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
      const total = (c.items ?? []).length;
      const marcados = Array.isArray(o.marcados) ? [...new Set(o.marcados.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < total))].sort((a, b) => a - b) : [];
      r[c.id] = { marcados, adicional: typeof o.adicional === "string" ? o.adicional.slice(0, MAX_TEXTO) : "" };
      continue;
    }
    if (typeof v === "string") {
      if (c.tipo === "seleccion" && v && !(c.opciones ?? []).includes(v)) continue;
      if (c.tipo === "si_no" && v && v !== "Sí" && v !== "No") continue;
      r[c.id] = v.slice(0, MAX_TEXTO);
    }
  }
  return r;
}

const ID_VALIDO = /^[a-z][a-z0-9_]{0,39}$/;

export function idDesdeEtiqueta(etiqueta: string, usados: Set<string>): string {
  const base =
    etiqueta
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 32) || "campo";
  let id = base;
  let i = 2;
  while (usados.has(id)) id = `${base}_${i++}`;
  return id;
}

export function validarEstructura(entrada: unknown): { estructura: EstructuraFormato } | { error: string } {
  if (!entrada || typeof entrada !== "object") return { error: "La estructura del formato no es válida." };
  const secciones = (entrada as { secciones?: unknown }).secciones;
  if (!Array.isArray(secciones) || secciones.length === 0) return { error: "El formato debe tener al menos una sección." };
  const idsCampo = new Set<string>();
  const idsSeccion = new Set<string>();
  const resultado: Seccion[] = [];
  for (const s of secciones as Record<string, unknown>[]) {
    const titulo = typeof s.titulo === "string" ? s.titulo.trim().slice(0, 200) : "";
    const id = typeof s.id === "string" ? s.id : "";
    if (!titulo) return { error: "Todas las secciones deben tener título." };
    if (!ID_VALIDO.test(id) || idsSeccion.has(id)) return { error: `Identificador de sección no válido o repetido: «${id}».` };
    idsSeccion.add(id);
    const campos: Campo[] = [];
    for (const c of (Array.isArray(s.campos) ? s.campos : []) as Record<string, unknown>[]) {
      const campo = sanearCampo(c);
      if ("error" in campo) return { error: `Sección «${titulo}»: ${campo.error}` };
      if (idsCampo.has(campo.campo.id)) return { error: `El identificador «${campo.campo.id}» está repetido.` };
      idsCampo.add(campo.campo.id);
      campos.push(campo.campo);
    }
    resultado.push({ id, titulo, campos });
  }
  const estructura: EstructuraFormato = { secciones: resultado };
  const refs = idsReferenciables(estructura);
  for (const c of camposPlanos(estructura)) {
    if (c.tipo === "calculado") {
      const e = validarFormula(c.formula ?? "", refs);
      if (e) return { error: `Cálculo «${c.etiqueta}»: ${e}` };
    }
    if (c.tipo === "tabla") {
      const cols = c.columnas ?? [];
      if (cols.length === 0) return { error: `La tabla «${c.etiqueta}» no tiene columnas.` };
      const idsCol = new Set(cols.filter((x) => x.tipo === "numero" || x.tipo === "calculado").map((x) => x.id));
      for (const col of cols) {
        if (col.tipo === "calculado") {
          const e = validarFormula(col.formula ?? "", idsCol);
          if (e) return { error: `Tabla «${c.etiqueta}», columna «${col.titulo}»: ${e}` };
        }
        if (col.tipo === "cumplimiento" && ((col.limite && !cols.some((x) => x.id === col.limite)) || (col.resultado && !cols.some((x) => x.id === col.resultado)))) {
          return { error: `Tabla «${c.etiqueta}», columna «${col.titulo}»: las columnas de límite y resultado no existen.` };
        }
      }
    }
  }
  return { estructura };
}

function texto(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function sanearCampo(c: Record<string, unknown>): { campo: Campo } | { error: string } {
  const id = typeof c.id === "string" ? c.id : "";
  const etiqueta = texto(c.etiqueta, 300);
  const tipo = c.tipo as TipoCampo;
  if (!etiqueta) return { error: "hay un campo sin nombre." };
  if (!ID_VALIDO.test(id)) return { error: `identificador no válido: «${id}» (solo minúsculas, números y guion bajo).` };
  if (!(tipo in TIPOS_CAMPO)) return { error: `tipo de campo desconocido en «${etiqueta}».` };
  const campo: Campo = { id, etiqueta, tipo };
  if (c.obligatorio === true && tipo !== "calculado") campo.obligatorio = true;
  const ayuda = texto(c.ayuda, 500);
  if (ayuda) campo.ayuda = ayuda;
  if ((tipo === "texto" || tipo === "fecha" || tipo === "numero" || tipo === "parrafo") && typeof c.precarga === "string" && c.precarga in PRECARGAS) {
    campo.precarga = c.precarga as ClavePrecarga;
  }
  if (tipo === "parrafo") {
    const p = texto(c.plantilla, 20_000);
    if (p) campo.plantilla = p;
  }
  if (tipo === "seleccion") {
    const opciones = Array.isArray(c.opciones) ? [...new Set(c.opciones.map((o) => String(o).trim()).filter(Boolean))].slice(0, 60) : [];
    if (opciones.length < 2) return { error: `la lista «${etiqueta}» necesita al menos dos opciones.` };
    campo.opciones = opciones;
  }
  if (tipo === "numero" || tipo === "calculado") {
    const u = texto(c.unidad, 30);
    if (u) campo.unidad = u;
    if (Number.isInteger(c.decimales) && (c.decimales as number) >= 0 && (c.decimales as number) <= 6) campo.decimales = c.decimales as number;
  }
  if (tipo === "calculado") campo.formula = typeof c.formula === "string" ? c.formula.trim().slice(0, 500) : "";
  if (tipo === "coordenadas" && c.conCota === true) campo.conCota = true;
  if (tipo === "lista_chequeo") {
    const items = (Array.isArray(c.items) ? c.items : [])
      .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : {}))
      .map((it) => ({ texto: texto(it.texto, 5_000) ?? "", marcado: it.marcado === true }))
      .filter((it) => it.texto)
      .slice(0, 80)
      .map((it) => (it.marcado ? it : { texto: it.texto }));
    if (items.length === 0) return { error: `la lista de chequeo «${etiqueta}» no tiene textos.` };
    campo.items = items;
  }
  if (tipo === "tabla") {
    const idsCol = new Set<string>();
    const columnas: ColumnaTabla[] = [];
    for (const col of (Array.isArray(c.columnas) ? c.columnas : []) as Record<string, unknown>[]) {
      const cid = typeof col.id === "string" ? col.id : "";
      const titulo = texto(col.titulo, 120);
      const ctipo = col.tipo as TipoColumna;
      if (!titulo) return { error: `la tabla «${etiqueta}» tiene una columna sin título.` };
      if (!ID_VALIDO.test(cid) || idsCol.has(cid)) return { error: `la tabla «${etiqueta}» tiene una columna con identificador no válido o repetido («${cid}»).` };
      if (!(ctipo in TIPOS_COLUMNA)) return { error: `tipo de columna desconocido en «${titulo}».` };
      idsCol.add(cid);
      const nueva: ColumnaTabla = { id: cid, titulo, tipo: ctipo };
      if (ctipo === "calculado") nueva.formula = typeof col.formula === "string" ? col.formula.trim().slice(0, 500) : "";
      if ((ctipo === "numero" || ctipo === "calculado") && Number.isInteger(col.decimales) && (col.decimales as number) >= 0 && (col.decimales as number) <= 6) {
        nueva.decimales = col.decimales as number;
      }
      if ((ctipo === "numero" || ctipo === "calculado") && col.total === true) nueva.total = true;
      if (ctipo === "numero" && col.vacioComoCero === true) nueva.vacioComoCero = true;
      if (ctipo === "cumplimiento") {
        if (typeof col.limite === "string" && col.limite) nueva.limite = col.limite;
        if (typeof col.resultado === "string" && col.resultado) nueva.resultado = col.resultado;
      }
      columnas.push(nueva);
    }
    campo.columnas = columnas;
    const filas = (Array.isArray(c.filasIniciales) ? c.filasIniciales : []).slice(0, 100).map((f) => {
      const o = f && typeof f === "object" ? (f as Record<string, unknown>) : {};
      const fila: FilaTabla = {};
      for (const col of columnas) if (col.tipo !== "calculado" && typeof o[col.id] === "string" && (o[col.id] as string).trim()) fila[col.id] = (o[col.id] as string).slice(0, 2_000);
      return fila;
    });
    if (filas.length) campo.filasIniciales = filas;
    const ag = c.agrupar && typeof c.agrupar === "object" ? (c.agrupar as Record<string, unknown>) : null;
    if (ag) {
      const por = Array.isArray(ag.por) ? ag.por.filter((x): x is string => typeof x === "string" && idsCol.has(x)) : [];
      const sumar = Array.isArray(ag.sumar) ? ag.sumar.filter((x): x is string => typeof x === "string" && idsCol.has(x)) : [];
      if (por.length && sumar.length) campo.agrupar = { por, sumar, ...(texto(ag.titulo, 200) ? { titulo: texto(ag.titulo, 200) } : {}) };
    }
  }
  return { campo };
}

export function resumenAgrupado(campo: Campo, valor: ValorCampo | undefined): { claves: string[]; sumas: (number | null)[]; conteo: number }[] {
  if (!campo.agrupar) return [];
  const grupos = new Map<string, { claves: string[]; sumas: (number | null)[]; conteo: number }>();
  for (const f of filasConDatos(campo, valor)) {
    const claves = campo.agrupar.por.map((k) => (f[k] ?? "").trim());
    const llave = claves.join("\u0000").toLowerCase();
    const g = grupos.get(llave) ?? { claves, sumas: campo.agrupar.sumar.map(() => null), conteo: 0 };
    g.conteo++;
    campo.agrupar.sumar.forEach((col, i) => {
      const v = valorColumnaFila(campo, f, col);
      if (v != null) g.sumas[i] = (g.sumas[i] ?? 0) + v;
    });
    grupos.set(llave, g);
  }
  return [...grupos.values()];
}

export function aDms(valor: number, esLat: boolean): string {
  const abs = Math.abs(valor);
  const g = Math.floor(abs);
  const mFloat = (abs - g) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  const hemi = esLat ? (valor >= 0 ? "N" : "S") : valor >= 0 ? "E" : "O";
  return `${g}° ${m}' ${s.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" ${hemi}`;
}
