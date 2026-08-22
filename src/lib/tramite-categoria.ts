import type { ComponentType, SVGProps } from "react";
import {
  Droplets,
  TreePine,
  PawPrint,
  Wind,
  Recycle,
  Truck,
  Scale,
  Mountain,
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
 * Paleta e íconos — segunda vuelta de ajuste a partir de una referencia
 * visual que el usuario mostró (otra CAR: píldoras verde-azuladas, un ícono
 * detallado en un círculo oscuro + texto en blanco sobre el mismo tono, sin
 * variar el color por categoría). Antes había 12 tonos, luego 6 agrupados
 * por familia — igual se sentía como demasiado color para una entidad
 * seria. Ahora es un solo color institucional (el verde de la CDMB, en dos
 * tonos: uno oscuro para el círculo del ícono, uno para el fondo de la
 * píldora/insignia) para TODAS las categorías reales — la diferencia entre
 * categorías la da la forma del ícono, no el matiz. Los emojis se
 * reemplazaron por íconos de línea propios primero, y ahora por
 * lucide-react (MIT, sin nuevas vulnerabilidades) — el estilo "propio"
 * a mano no llegaba al nivel de acabado de la referencia. Solo lo NO
 * verificado (sin SUIT, prueba) se queda neutro/gris a propósito, para
 * seguir distinguiendo "esto no pasó por la verificación oficial".
 */
type ColorToken = "cdmb" | "stone";

const CLASES_COLOR: Record<ColorToken, { icono: string; badge: string; barra: string; borde: string; pildora: string }> = {
  cdmb: { icono: "bg-cdmb-700 text-white", badge: "bg-cdmb-50 text-cdmb-700", barra: "bg-cdmb-500", borde: "border-cdmb-500", pildora: "bg-cdmb-600" },
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

/** Orden en que aparecen las secciones del catálogo — de mayor a menor peso entre los trámites inscritos en el SUIT. */
const REGLAS: { id: string; Icono: IconComponent; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { id: "hidrico", Icono: Droplets, etiqueta: "Recurso Hídrico", color: "cdmb", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { id: "flora", Icono: TreePine, etiqueta: "Recurso Flora", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { id: "fauna", Icono: PawPrint, etiqueta: "Fauna Silvestre", color: "cdmb", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { id: "aire", Icono: Wind, etiqueta: "Recurso Aire", color: "cdmb", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { id: "residuos", Icono: Recycle, etiqueta: "Residuos", color: "cdmb", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { id: "transporte", Icono: Truck, etiqueta: "Transporte / Vehículos", color: "cdmb", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { id: "licencias", Icono: Scale, etiqueta: "Licencia Ambiental", color: "cdmb", palabras: ["licencia", "anla"] },
  { id: "mineria", Icono: Mountain, etiqueta: "Minería", color: "cdmb", palabras: ["minera", "minería", "mineria"] },
  { id: "gestion", Icono: Building2, etiqueta: "Gestión", color: "cdmb", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
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
