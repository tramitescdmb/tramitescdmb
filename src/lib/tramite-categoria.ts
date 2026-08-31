import type { ComponentType, SVGProps } from "react";
import {
  Droplets,
  TreePine,
  PawPrint,
  Wind,
  Recycle,
  Truck,
  Scale,
  Building2,
  Coins,
  FileText,
  FlaskConical,
} from "lucide-react";

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
 * Paleta e íconos — tercera vuelta. Las dos anteriores (12 tonos sueltos, y
 * luego un solo verde institucional para todo, diferenciando solo por
 * forma de ícono) resultaron, en los dos sentidos opuestos, poco intuitivas:
 * con 12 tonos sueltos no se sabía si el color significaba algo; con un
 * solo tono, reconocer la categoría exigía leer el ícono uno por uno en vez
 * de "verlo" de un vistazo. Esta paleta sigue el método de color
 * categórico de la skill `dataviz` (references/color-formula.md): 8
 * familias de matiz, en orden fijo, escogidas por separación bajo
 * daltonismo (protanopia/deuteranopia) y no solo "a ojo" — una por cada una
 * de las 8 categorías reales que hoy tienen trámites (ver conteo verificado
 * contra `data/tramites/*.json`; si `M-DA-PR*` cambia y una categoría queda
 * en 9, la novena NO debe inventarse un tono más — se dobla dentro de
 * "Otros Trámites", como manda la regla de la skill). La asociación
 * categoría→matiz busca además ser intuitiva por sí misma donde el mundo
 * real ya tiene una asociación fuerte (agua = azul, flora = verde) y usa
 * el resto de la rueda para separar visualmente lo que no la tiene. Los
 * íconos de línea son de lucide-react. Lo NO verificado (sin SUIT, prueba)
 * se queda neutro/gris a propósito, para seguir distinguiendo "esto no
 * pasó por la verificación oficial" de las categorías reales.
 */
type ColorToken = "cdmb" | "stone" | "azul" | "ambar" | "verdeagua" | "naranja" | "indigo" | "violeta" | "fucsia";

const CLASES_COLOR: Record<ColorToken, { icono: string; badge: string; barra: string; borde: string; pildora: string }> = {
  // Recurso Hídrico — el agua ya es azul en la cabeza de cualquiera; no tenía sentido pelear esa asociación.
  azul: { icono: "bg-blue-700 text-white", badge: "bg-blue-50 text-blue-700", barra: "bg-blue-500", borde: "border-blue-500", pildora: "bg-blue-600" },
  // Recurso Flora — el verde institucional de la CDMB, que además ya es "plantas" para cualquiera. Doble acierto.
  cdmb: { icono: "bg-cdmb-700 text-white", badge: "bg-cdmb-50 text-cdmb-700", barra: "bg-cdmb-500", borde: "border-cdmb-500", pildora: "bg-cdmb-600" },
  // Fauna Silvestre — tono cálido y terroso, distinto del verde de flora y del azul de agua.
  ambar: { icono: "bg-amber-700 text-white", badge: "bg-amber-50 text-amber-800", barra: "bg-amber-500", borde: "border-amber-500", pildora: "bg-amber-700" },
  // Recurso Aire — verde azulado, evoca "atmósfera" sin repetir ni el azul del agua ni el verde de flora.
  verdeagua: { icono: "bg-teal-700 text-white", badge: "bg-teal-50 text-teal-700", barra: "bg-teal-500", borde: "border-teal-500", pildora: "bg-teal-700" },
  // Residuos — tono de alerta/reciclaje, sin llegar al rojo (que en el resto de la app significa "negado/rechazado").
  naranja: { icono: "bg-orange-700 text-white", badge: "bg-orange-50 text-orange-800", barra: "bg-orange-500", borde: "border-orange-500", pildora: "bg-orange-700" },
  // Transporte / Vehículos — azul-violeta, contenido y serio, distinto del azul puro de agua.
  indigo: { icono: "bg-indigo-700 text-white", badge: "bg-indigo-50 text-indigo-700", barra: "bg-indigo-500", borde: "border-indigo-500", pildora: "bg-indigo-600" },
  // Licencia Ambiental — violeta, el tono que más se asocia con lo institucional/legal.
  violeta: { icono: "bg-violet-700 text-white", badge: "bg-violet-50 text-violet-700", barra: "bg-violet-500", borde: "border-violet-500", pildora: "bg-violet-600" },
  // Gestión — bolsa administrativa residual; el último tono de la rueda, sin choque con ningún otro.
  fucsia: { icono: "bg-fuchsia-700 text-white", badge: "bg-fuchsia-50 text-fuchsia-800", barra: "bg-fuchsia-500", borde: "border-fuchsia-500", pildora: "bg-fuchsia-700" },
  // Neutro — a propósito, para lo que NO pasó por la verificación del SUIT (ver comentario arriba).
  stone: { icono: "bg-stone-600 text-white", badge: "bg-stone-100 text-stone-600", barra: "bg-stone-300", borde: "border-stone-300", pildora: "bg-stone-500" },
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type CategoriaFija = { id: string; Icono: IconComponent; etiqueta: string; color: ColorToken };

/** Las 3 "tasas" de cdmb.gov.co/tema/tramites-y-servicios/instrumentos-economicos — se identifican por `codigo` (prefijo "IE-"), no por palabras del nombre. */
const CATEGORIA_INSTRUMENTOS_ECONOMICOS: CategoriaFija = {
  id: "economicos",
  Icono: Coins,
  etiqueta: "Instrumentos Económicos",
  color: "cdmb",
};

/** Trámite de ejemplo para probar la interfaz (`TEST-01`) — nunca se mezcla con trámites reales. */
const CATEGORIA_PRUEBA: CategoriaFija = {
  id: "prueba",
  Icono: FlaskConical,
  etiqueta: "Trámite de Prueba",
  color: "stone",
};

/** Trámites reales de la CDMB que todavía no están inscritos en el SUIT — aparte de las subcategorías por recurso. */
const CATEGORIA_SIN_SUIT: CategoriaFija = {
  id: "sin-suit",
  Icono: FileText,
  etiqueta: "Sin registro en el SUIT",
  color: "stone",
};

/**
 * Orden en que aparecen las secciones del catálogo — de mayor a menor peso
 * entre los trámites inscritos en el SUIT. "Minería" existió como categoría
 * en algún momento pero ningún trámite real cae ahí — el único candidato
 * (M-DA-PR65, "Licencia Ambiental Temporal para Formalización Minera") es
 * procedimentalmente una Licencia Ambiental (mismo flujo que M-DA-PR22), así
 * que cae en "licencias" antes de llegar a esa regla. Se quitó la categoría
 * fantasma en vez de dejarla sembrada sin uso — confundía sin aportar nada
 * (ver `tramites/page.tsx`, que ya filtra secciones vacías, así que el bug
 * era silencioso: la categoría simplemente nunca aparecía).
 */
const REGLAS: { id: string; Icono: IconComponent; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { id: "hidrico", Icono: Droplets, etiqueta: "Recurso Hídrico", color: "azul", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { id: "flora", Icono: TreePine, etiqueta: "Recurso Flora", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { id: "fauna", Icono: PawPrint, etiqueta: "Fauna Silvestre", color: "ambar", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { id: "aire", Icono: Wind, etiqueta: "Recurso Aire", color: "verdeagua", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { id: "residuos", Icono: Recycle, etiqueta: "Residuos", color: "naranja", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { id: "transporte", Icono: Truck, etiqueta: "Transporte / Vehículos", color: "indigo", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { id: "licencias", Icono: Scale, etiqueta: "Licencia Ambiental", color: "violeta", palabras: ["licencia", "anla"] },
  { id: "gestion", Icono: Building2, etiqueta: "Gestión", color: "fucsia", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
];

const OTROS: CategoriaFija = {
  id: "otros",
  Icono: FileText,
  etiqueta: "Otros Trámites",
  color: "stone",
};

export type Categoria = {
  id: string;
  Icono: IconComponent;
  etiqueta: string;
  clases: { icono: string; badge: string; barra: string; borde: string; pildora: string };
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
  return { id: c.id, Icono: c.Icono, etiqueta: c.etiqueta, clases: CLASES_COLOR[c.color] };
}

export function categoriaTramite(nombre: string, codigo?: string, suitNumeros?: string[]): Categoria {
  if (codigo?.startsWith("IE-")) return categoriaDesdeFija(CATEGORIA_INSTRUMENTOS_ECONOMICOS);
  if (codigo?.startsWith("TEST")) return categoriaDesdeFija(CATEGORIA_PRUEBA);
  if (!suitNumeros || suitNumeros.length === 0) return categoriaDesdeFija(CATEGORIA_SIN_SUIT);

  const texto = nombre.toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) {
      return { id: regla.id, Icono: regla.Icono, etiqueta: regla.etiqueta, clases: CLASES_COLOR[regla.color] };
    }
  }
  return categoriaDesdeFija(OTROS);
}

/** Todas las categorías, en el orden en que deben mostrarse las secciones del catálogo. */
export const CATEGORIAS_ORDEN: Categoria[] = [
  ...REGLAS.map((r) => ({ id: r.id, Icono: r.Icono, etiqueta: r.etiqueta, clases: CLASES_COLOR[r.color] })),
  categoriaDesdeFija(OTROS),
  categoriaDesdeFija(CATEGORIA_INSTRUMENTOS_ECONOMICOS),
  categoriaDesdeFija(CATEGORIA_SIN_SUIT),
  categoriaDesdeFija(CATEGORIA_PRUEBA),
];
