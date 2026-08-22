/**
 * Ícono + color + categoría por tipo de trámite. Se usa para (1) reconocer
 * cada trámite de un vistazo en el catálogo y el detalle, y (2) agrupar el
 * catálogo en secciones.
 *
 * La agrupación por recurso/tema (Recurso Hídrico, Recurso Flora, Fauna
 * Silvestre...) — mismo criterio que usan otras Corporaciones Autónomas
 * Regionales en su sitio de trámites (CAR.gov.co) — aplica SOLO a los
 * trámites inscritos en el SUIT: son los que el usuario confirmó como "los
 * 20 trámites ambientales" reales (memorando ADEI-143/2026), verificados
 * contra cdmb.gov.co/tema/tramites-y-servicios/tramites-inscritos-en-el-
 * sistema-unico-de-informacion. Los demás NO se reparten dentro de esas
 * subcategorías (aunque su nombre mencione "agua" o "forestal") — van
 * aparte, en "Sin registro en el SUIT", a propósito, para no mezclar algo
 * verificado con algo que no lo está. El tercer argumento de
 * `categoriaTramite` debe ser el resultado de `todosLosSuitNumeros()` (ver
 * abajo), no `tramite.suitNumeros` a secas — un trámite puede tener el
 * número a nivel de flujo en vez de a nivel de trámite (ver M-DA-PR21).
 *
 * Los nombres de clases de Tailwind están escritos completos a propósito
 * (no armados con `${color}-100`): Tailwind solo genera CSS para clases que
 * puede ver como texto literal en el código fuente.
 */
type ColorToken =
  | "sky"
  | "cdmb"
  | "amber"
  | "orange"
  | "cyan"
  | "rose"
  | "teal"
  | "indigo"
  | "violet"
  | "yellow"
  | "slate"
  | "stone";

// Antes los íconos usaban un tono más saturado que las tarjetitas (badge) — con 9+ categorías
// visibles a la vez eso se sentía como "demasiado color". Ahora íconos y badge comparten el
// mismo tono suave (-50): la categoría se sigue distinguiendo por el emoji y el color, pero con
// menos intensidad total en pantalla.
const CLASES_COLOR: Record<ColorToken, { icono: string; badge: string; barra: string; borde: string }> = {
  sky: { icono: "bg-sky-50 text-sky-600", badge: "bg-sky-50 text-sky-700", barra: "bg-sky-400", borde: "border-sky-400" },
  cdmb: { icono: "bg-cdmb-50 text-cdmb-600", badge: "bg-cdmb-50 text-cdmb-700", barra: "bg-cdmb-400", borde: "border-cdmb-400" },
  amber: { icono: "bg-amber-50 text-amber-600", badge: "bg-amber-50 text-amber-700", barra: "bg-amber-400", borde: "border-amber-400" },
  orange: { icono: "bg-orange-50 text-orange-600", badge: "bg-orange-50 text-orange-700", barra: "bg-orange-400", borde: "border-orange-400" },
  cyan: { icono: "bg-cyan-50 text-cyan-600", badge: "bg-cyan-50 text-cyan-700", barra: "bg-cyan-400", borde: "border-cyan-400" },
  rose: { icono: "bg-rose-50 text-rose-600", badge: "bg-rose-50 text-rose-700", barra: "bg-rose-400", borde: "border-rose-400" },
  teal: { icono: "bg-teal-50 text-teal-600", badge: "bg-teal-50 text-teal-700", barra: "bg-teal-400", borde: "border-teal-400" },
  indigo: { icono: "bg-indigo-50 text-indigo-600", badge: "bg-indigo-50 text-indigo-700", barra: "bg-indigo-400", borde: "border-indigo-400" },
  violet: { icono: "bg-violet-50 text-violet-600", badge: "bg-violet-50 text-violet-700", barra: "bg-violet-400", borde: "border-violet-400" },
  yellow: { icono: "bg-yellow-50 text-yellow-600", badge: "bg-yellow-50 text-yellow-700", barra: "bg-yellow-400", borde: "border-yellow-400" },
  slate: { icono: "bg-slate-100 text-slate-600", badge: "bg-slate-100 text-slate-700", barra: "bg-slate-400", borde: "border-slate-400" },
  stone: { icono: "bg-stone-100 text-stone-500", badge: "bg-stone-100 text-stone-600", barra: "bg-stone-300", borde: "border-stone-300" },
};

type CategoriaFija = { id: string; emoji: string; etiqueta: string; color: ColorToken };

/** Las 3 "tasas" de cdmb.gov.co/tema/tramites-y-servicios/instrumentos-economicos — se identifican por `codigo` (prefijo "IE-"), no por palabras del nombre. */
const CATEGORIA_INSTRUMENTOS_ECONOMICOS: CategoriaFija = {
  id: "economicos",
  emoji: "💰",
  etiqueta: "Instrumentos Económicos",
  color: "yellow",
};

/** Trámite de ejemplo para probar la interfaz (`TEST-01`) — nunca se mezcla con trámites reales. */
const CATEGORIA_PRUEBA: CategoriaFija = {
  id: "prueba",
  emoji: "🧪",
  etiqueta: "Trámite de Prueba",
  color: "stone",
};

/** Trámites reales de la CDMB que todavía no están inscritos en el SUIT — aparte de las subcategorías por recurso. */
const CATEGORIA_SIN_SUIT: CategoriaFija = {
  id: "sin-suit",
  emoji: "📄",
  etiqueta: "Sin registro en el SUIT",
  color: "slate",
};

/** Orden en que aparecen las secciones del catálogo — de mayor a menor peso entre los trámites inscritos en el SUIT. */
const REGLAS: { id: string; emoji: string; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { id: "hidrico", emoji: "💧", etiqueta: "Recurso Hídrico", color: "sky", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { id: "flora", emoji: "🌳", etiqueta: "Recurso Flora", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { id: "fauna", emoji: "🦉", etiqueta: "Fauna Silvestre", color: "amber", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { id: "aire", emoji: "🌬️", etiqueta: "Recurso Aire", color: "cyan", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { id: "residuos", emoji: "♻️", etiqueta: "Residuos", color: "teal", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { id: "transporte", emoji: "🚚", etiqueta: "Transporte / Vehículos", color: "rose", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { id: "licencias", emoji: "⚖️", etiqueta: "Licencia Ambiental", color: "indigo", palabras: ["licencia", "anla"] },
  { id: "mineria", emoji: "⛏️", etiqueta: "Minería", color: "orange", palabras: ["minera", "minería", "mineria"] },
  { id: "gestion", emoji: "🏢", etiqueta: "Gestión", color: "violet", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
];

const OTROS: CategoriaFija = {
  id: "otros",
  emoji: "📋",
  etiqueta: "Otros Trámites",
  color: "stone",
};

export type Categoria = {
  id: string;
  emoji: string;
  etiqueta: string;
  clases: { icono: string; badge: string; barra: string; borde: string };
};

/**
 * Une el/los número(s) SUIT del trámite con el de cada uno de sus flujos —
 * la mayoría de trámites tienen el número a nivel de TramiteTipo (un solo
 * registro cubre todo el procedimiento), pero algunos lo tienen a nivel de
 * Flujo (ej. M-DA-PR21: un solo procedimiento/PDF, pero "Concesión de Aguas
 * Superficiales" y "Concesión de Aguas Subterráneas" son dos fichas SUIT
 * distintas, una por flujo). Sin combinar los dos, un trámite así parecería
 * "sin registro en el SUIT" al no tener nada en TramiteTipo.suitNumeros.
 */
export function todosLosSuitNumeros(tramite: {
  suitNumeros: string[];
  flujos: { suitNumero: string | null }[];
}): string[] {
  const numeros = new Set(tramite.suitNumeros);
  for (const f of tramite.flujos) {
    if (f.suitNumero) numeros.add(f.suitNumero);
  }
  return Array.from(numeros);
}

function categoriaDesdeFija(c: CategoriaFija): Categoria {
  return { id: c.id, emoji: c.emoji, etiqueta: c.etiqueta, clases: CLASES_COLOR[c.color] };
}

export function categoriaTramite(nombre: string, codigo?: string, suitNumeros?: string[]): Categoria {
  if (codigo?.startsWith("IE-")) return categoriaDesdeFija(CATEGORIA_INSTRUMENTOS_ECONOMICOS);
  if (codigo?.startsWith("TEST")) return categoriaDesdeFija(CATEGORIA_PRUEBA);
  if (!suitNumeros || suitNumeros.length === 0) return categoriaDesdeFija(CATEGORIA_SIN_SUIT);

  const texto = nombre.toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) {
      return { id: regla.id, emoji: regla.emoji, etiqueta: regla.etiqueta, clases: CLASES_COLOR[regla.color] };
    }
  }
  return categoriaDesdeFija(OTROS);
}

/** Todas las categorías, en el orden en que deben mostrarse las secciones del catálogo. */
export const CATEGORIAS_ORDEN: Categoria[] = [
  ...REGLAS.map((r) => ({ id: r.id, emoji: r.emoji, etiqueta: r.etiqueta, clases: CLASES_COLOR[r.color] })),
  categoriaDesdeFija(OTROS),
  categoriaDesdeFija(CATEGORIA_INSTRUMENTOS_ECONOMICOS),
  categoriaDesdeFija(CATEGORIA_SIN_SUIT),
  categoriaDesdeFija(CATEGORIA_PRUEBA),
];
