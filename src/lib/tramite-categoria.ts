/**
 * Ícono + color por tipo de trámite, para que el catálogo y el detalle se
 * reconozcan de un vistazo (agua, bosque, vehículos...) en vez de ser 30
 * tarjetas idénticas. Se infiere por palabras clave del nombre — no hace
 * falta tocar los JSON de datos para esto, es solo presentación.
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

const REGLAS: { emoji: string; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { emoji: "💧", etiqueta: "Agua / vertimientos", color: "sky", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { emoji: "🌳", etiqueta: "Bosques / árboles", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { emoji: "🦉", etiqueta: "Fauna silvestre", color: "amber", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { emoji: "⛏️", etiqueta: "Minería", color: "orange", palabras: ["minera", "minería", "mineria"] },
  { emoji: "🌬️", etiqueta: "Aire / emisiones", color: "cyan", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { emoji: "🚚", etiqueta: "Transporte / vehículos", color: "rose", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { emoji: "♻️", etiqueta: "Residuos", color: "teal", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { emoji: "⚖️", etiqueta: "Licencias / permisos generales", color: "indigo", palabras: ["licencia", "anla"] },
  { emoji: "🏢", etiqueta: "Gestión ambiental empresarial", color: "violet", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
];

export type Categoria = { emoji: string; etiqueta: string; clases: { icono: string; badge: string; barra: string; borde: string } };

export function categoriaTramite(nombre: string): Categoria {
  const texto = nombre.toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) {
      return { emoji: regla.emoji, etiqueta: regla.etiqueta, clases: CLASES_COLOR[regla.color] };
    }
  }
  return { emoji: "📋", etiqueta: "Trámite ambiental", clases: CLASES_COLOR.stone };
}
