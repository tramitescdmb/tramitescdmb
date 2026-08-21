/**
 * Ícono + color + categoría por tipo de trámite. Se usa para (1) reconocer
 * cada trámite de un vistazo en el catálogo y el detalle, y (2) agrupar el
 * catálogo en secciones por recurso/tema — mismo criterio que usan otras
 * Corporaciones Autónomas Regionales en su sitio de trámites (CAR.gov.co:
 * Recurso Hídrico, Recurso Aire, Recurso Flora, Fauna Silvestre, Licencia
 * Ambiental, Gestión...), adaptado a los 30 trámites reales de la CDMB (no
 * se copian categorías de CAR que aquí no tendrían ningún trámite adentro).
 * Se infiere por palabras clave del nombre — no hace falta tocar los JSON
 * de datos para esto, es solo presentación.
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
  | "stone";

const CLASES_COLOR: Record<ColorToken, { icono: string; badge: string; barra: string; borde: string }> = {
  sky: { icono: "bg-sky-100 text-sky-700", badge: "bg-sky-50 text-sky-700", barra: "bg-sky-400", borde: "border-sky-400" },
  cdmb: { icono: "bg-cdmb-100 text-cdmb-700", badge: "bg-cdmb-50 text-cdmb-700", barra: "bg-cdmb-400", borde: "border-cdmb-400" },
  amber: { icono: "bg-amber-100 text-amber-700", badge: "bg-amber-50 text-amber-700", barra: "bg-amber-400", borde: "border-amber-400" },
  orange: { icono: "bg-orange-100 text-orange-700", badge: "bg-orange-50 text-orange-700", barra: "bg-orange-400", borde: "border-orange-400" },
  cyan: { icono: "bg-cyan-100 text-cyan-700", badge: "bg-cyan-50 text-cyan-700", barra: "bg-cyan-400", borde: "border-cyan-400" },
  rose: { icono: "bg-rose-100 text-rose-700", badge: "bg-rose-50 text-rose-700", barra: "bg-rose-400", borde: "border-rose-400" },
  teal: { icono: "bg-teal-100 text-teal-700", badge: "bg-teal-50 text-teal-700", barra: "bg-teal-400", borde: "border-teal-400" },
  indigo: { icono: "bg-indigo-100 text-indigo-700", badge: "bg-indigo-50 text-indigo-700", barra: "bg-indigo-400", borde: "border-indigo-400" },
  violet: { icono: "bg-violet-100 text-violet-700", badge: "bg-violet-50 text-violet-700", barra: "bg-violet-400", borde: "border-violet-400" },
  stone: { icono: "bg-stone-200 text-stone-600", badge: "bg-stone-100 text-stone-600", barra: "bg-stone-300", borde: "border-stone-300" },
};

/** Orden en que aparecen las secciones del catálogo — de mayor a menor peso en los 30 trámites de la CDMB. */
const REGLAS: { id: string; emoji: string; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { id: "hidrico", emoji: "💧", etiqueta: "Recurso Hídrico", color: "sky", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer", "tasa retributiva"] },
  { id: "flora", emoji: "🌳", etiqueta: "Recurso Flora", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { id: "fauna", emoji: "🦉", etiqueta: "Fauna Silvestre", color: "amber", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { id: "aire", emoji: "🌬️", etiqueta: "Recurso Aire", color: "cyan", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { id: "residuos", emoji: "♻️", etiqueta: "Residuos", color: "teal", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { id: "transporte", emoji: "🚚", etiqueta: "Transporte / Vehículos", color: "rose", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { id: "licencias", emoji: "⚖️", etiqueta: "Licencia Ambiental", color: "indigo", palabras: ["licencia", "anla"] },
  { id: "mineria", emoji: "⛏️", etiqueta: "Minería", color: "orange", palabras: ["minera", "minería", "mineria"] },
  { id: "gestion", emoji: "🏢", etiqueta: "Gestión", color: "violet", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
];

const OTROS: { id: string; emoji: string; etiqueta: string; color: ColorToken } = {
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

export function categoriaTramite(nombre: string): Categoria {
  const texto = nombre.toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) {
      return { id: regla.id, emoji: regla.emoji, etiqueta: regla.etiqueta, clases: CLASES_COLOR[regla.color] };
    }
  }
  return { id: OTROS.id, emoji: OTROS.emoji, etiqueta: OTROS.etiqueta, clases: CLASES_COLOR[OTROS.color] };
}

/** Todas las categorías, en el orden en que deben mostrarse las secciones del catálogo (Otros al final). */
export const CATEGORIAS_ORDEN: Categoria[] = [
  ...REGLAS.map((r) => ({ id: r.id, emoji: r.emoji, etiqueta: r.etiqueta, clases: CLASES_COLOR[r.color] })),
  { id: OTROS.id, emoji: OTROS.emoji, etiqueta: OTROS.etiqueta, clases: CLASES_COLOR[OTROS.color] },
];
