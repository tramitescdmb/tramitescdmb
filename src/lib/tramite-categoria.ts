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

type ColorToken =
  | "cdmb"
  | "stone"
  | "azul"
  | "ambar"
  | "cian"
  | "naranja"
  | "pizarra"
  | "violeta"
  | "rosa";

const CLASES_COLOR: Record<ColorToken, { icono: string; badge: string; barra: string; borde: string; pildora: string }> = {
  azul: { icono: "bg-blue-600 text-white", badge: "bg-blue-50 text-blue-700", barra: "bg-blue-500", borde: "border-blue-500", pildora: "bg-blue-600" },
  cdmb: { icono: "bg-cdmb-600 text-white", badge: "bg-cdmb-50 text-cdmb-700", barra: "bg-cdmb-500", borde: "border-cdmb-500", pildora: "bg-cdmb-600" },
  ambar: { icono: "bg-amber-700 text-white", badge: "bg-amber-50 text-amber-800", barra: "bg-amber-500", borde: "border-amber-500", pildora: "bg-amber-700" },
  cian: { icono: "bg-cyan-700 text-white", badge: "bg-cyan-50 text-cyan-800", barra: "bg-cyan-600", borde: "border-cyan-600", pildora: "bg-cyan-700" },
  naranja: { icono: "bg-orange-700 text-white", badge: "bg-orange-50 text-orange-800", barra: "bg-orange-500", borde: "border-orange-500", pildora: "bg-orange-700" },
  pizarra: { icono: "bg-slate-600 text-white", badge: "bg-slate-100 text-slate-700", barra: "bg-slate-500", borde: "border-slate-500", pildora: "bg-slate-600" },
  violeta: { icono: "bg-violet-600 text-white", badge: "bg-violet-50 text-violet-700", barra: "bg-violet-500", borde: "border-violet-500", pildora: "bg-violet-600" },
  rosa: { icono: "bg-pink-700 text-white", badge: "bg-pink-50 text-pink-700", barra: "bg-pink-500", borde: "border-pink-500", pildora: "bg-pink-700" },
  stone: { icono: "bg-stone-600 text-white", badge: "bg-stone-100 text-stone-600", barra: "bg-stone-300", borde: "border-stone-300", pildora: "bg-stone-500" },
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type CategoriaFija = { id: string; Icono: IconComponent; etiqueta: string; color: ColorToken };

const CATEGORIA_INSTRUMENTOS_ECONOMICOS: CategoriaFija = {
  id: "economicos",
  Icono: Coins,
  etiqueta: "Instrumentos Económicos",
  color: "cdmb",
};

const CATEGORIA_PRUEBA: CategoriaFija = {
  id: "prueba",
  Icono: FlaskConical,
  etiqueta: "Trámite de Prueba",
  color: "stone",
};

const CATEGORIA_SIN_SUIT: CategoriaFija = {
  id: "sin-suit",
  Icono: FileText,
  etiqueta: "Sin registro en el SUIT",
  color: "stone",
};

const REGLAS: { id: string; Icono: IconComponent; etiqueta: string; color: ColorToken; palabras: string[] }[] = [
  { id: "hidrico", Icono: Droplets, etiqueta: "Recurso Hídrico", color: "azul", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { id: "flora", Icono: TreePine, etiqueta: "Recurso Flora", color: "cdmb", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { id: "fauna", Icono: PawPrint, etiqueta: "Fauna Silvestre", color: "ambar", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { id: "aire", Icono: Wind, etiqueta: "Recurso Aire", color: "cian", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { id: "residuos", Icono: Recycle, etiqueta: "Residuos", color: "naranja", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { id: "transporte", Icono: Truck, etiqueta: "Transporte / Vehículos", color: "pizarra", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { id: "licencias", Icono: Scale, etiqueta: "Licencia Ambiental", color: "violeta", palabras: ["licencia", "anla"] },
  { id: "gestion", Icono: Building2, etiqueta: "Gestión", color: "rosa", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
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

export const CATEGORIAS_ORDEN: Categoria[] = [
  ...REGLAS.map((r) => ({ id: r.id, Icono: r.Icono, etiqueta: r.etiqueta, clases: CLASES_COLOR[r.color] })),
  categoriaDesdeFija(OTROS),
  categoriaDesdeFija(CATEGORIA_INSTRUMENTOS_ECONOMICOS),
  categoriaDesdeFija(CATEGORIA_SIN_SUIT),
  categoriaDesdeFija(CATEGORIA_PRUEBA),
];

export function agruparTramitesPorCategoria<T extends { id: string; codigo: string; nombre: string; suitNumeros: string[]; flujos: { suitNumero: string | null }[] }>(
  tramites: T[]
): { etiqueta: string; clases: Categoria["clases"]; items: T[] }[] {
  const porCategoria = new Map<string, T[]>();
  for (const t of tramites) {
    const cat = categoriaTramite(t.nombre, t.codigo, todosLosSuitNumeros(t));
    const lista = porCategoria.get(cat.id) ?? [];
    lista.push(t);
    porCategoria.set(cat.id, lista);
  }
  return CATEGORIAS_ORDEN.map((cat) => ({
    etiqueta: cat.etiqueta,
    clases: cat.clases,
    items: porCategoria.get(cat.id) ?? [],
  })).filter((g) => g.items.length > 0);
}
