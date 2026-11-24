/**
 * Negocios Verdes: exportar e importar negocios en CSV (mismas columnas que la plataforma anterior).
 * Importar solo toca datos públicos y clasificación: nunca fotos, productos, ficha técnica ni puntajes.
 * Un negocio nuevo entra sin publicar.
 */
import Papa from "papaparse";
import { normalizarTexto } from "@/lib/negocios-verdes";
import { validarNegocio, type NegocioValidado } from "@/lib/negocios-verdes-ficha";

export const ENCABEZADOS_CSV_NV = [
  "nombre",
  "municipio",
  "categorias",
  "subcategorias",
  "actividades_productivas",
  "direccion",
  "latitud",
  "longitud",
  "descripcion_corta",
  "descripcion",
  "telefono",
  "whatsapp",
  "email",
  "sitio_web",
  "facebook_url",
  "instagram_url",
  "avalado",
  "sello_marca",
  "emprendimiento_verde",
  "destacado",
  "activo",
  "id",
  "slug",
] as const;

export type NegocioParaCsv = {
  id: string;
  slug: string;
  nombre: string;
  municipio: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  descripcionCorta: string | null;
  descripcion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  sitioWeb: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  avalado: boolean;
  selloMarca: boolean;
  emprendimientoVerde: boolean;
  destacado: boolean;
  activo: boolean;
  categorias: string[];
  subcategorias: string[];
  actividades: string[];
};

const siNo = (b: boolean) => (b ? "SI" : "NO");

/** Evita que Excel interprete como fórmula un texto que empieza por =, +, - o @. */
function celda(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t) ? `'${t}` : t;
}

export function construirCsvNV(negocios: NegocioParaCsv[]): string {
  const filas = negocios.map((n) =>
    [
      n.nombre,
      n.municipio,
      n.categorias.join("|"),
      n.subcategorias.join("|"),
      n.actividades.join("|"),
      n.direccion,
      n.latitud,
      n.longitud,
      n.descripcionCorta,
      n.descripcion,
      n.telefono,
      n.whatsapp,
      n.email,
      n.sitioWeb,
      n.facebookUrl,
      n.instagramUrl,
      siNo(n.avalado),
      siNo(n.selloMarca),
      siNo(n.emprendimientoVerde),
      siNo(n.destacado),
      siNo(n.activo),
      n.id,
      n.slug,
    ].map(celda)
  );
  // Punto y coma y BOM: Excel en español lo abre en columnas y con tildes.
  return "﻿" + Papa.unparse({ fields: [...ENCABEZADOS_CSV_NV], data: filas }, { delimiter: ";" });
}

export type Taxon = { id: string; nombre: string };
export type CatalogoCsv = { categorias: Taxon[]; subcategorias: Taxon[]; actividades: Taxon[] };

export type FilaImportada = {
  fila: number;
  id: string | null;
  slug: string | null;
  datos: NegocioValidado | null;
  errores: string[];
};

const sinComilla = (t: string) => (t.startsWith("'") ? t.slice(1) : t);
const esSi = (v: string | undefined) => ["si", "sí", "s", "1", "true", "x"].includes(normalizarTexto(v));

function resolver(nombres: string | undefined, catalogo: Taxon[], tipo: string, errores: string[]): string[] {
  const indice = new Map(catalogo.map((t) => [normalizarTexto(t.nombre), t.id]));
  const ids: string[] = [];
  for (const n of (nombres ?? "").split("|").map((x) => x.trim()).filter(Boolean)) {
    const id = indice.get(normalizarTexto(n));
    if (id) ids.push(id);
    else errores.push(`${tipo} «${n}» no existe.`);
  }
  return ids;
}

/** Lee el CSV (coma o punto y coma) y valida cada fila sin tocar la base. */
export function interpretarCsvNV(texto: string, catalogo: CatalogoCsv): { filas: FilaImportada[]; errorGeneral: string | null } {
  const r = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => normalizarTexto(h).replace(/\s+/g, "_") });
  const campos = r.meta.fields ?? [];
  if (!campos.includes("nombre") || !campos.includes("municipio")) {
    return { filas: [], errorGeneral: "El archivo no tiene las columnas «nombre» y «municipio». Descargue la plantilla con «Exportar CSV»." };
  }
  if (r.data.length > 2000) return { filas: [], errorGeneral: "Máximo 2.000 filas por archivo." };
  const filas = r.data.map((f, i) => {
    const errores: string[] = [];
    const v = (k: string) => sinComilla((f[k] ?? "").trim());
    const categoriaIds = resolver(v("categorias"), catalogo.categorias, "Categoría", errores);
    const entrada = {
      nombre: v("nombre"),
      slug: v("slug") || undefined,
      municipio: municipioCanonico(v("municipio")),
      direccion: v("direccion"),
      latitud: v("latitud"),
      longitud: v("longitud"),
      descripcionCorta: v("descripcion_corta"),
      descripcion: v("descripcion"),
      telefono: v("telefono"),
      whatsapp: v("whatsapp"),
      email: v("email"),
      sitioWeb: v("sitio_web"),
      facebookUrl: v("facebook_url"),
      instagramUrl: v("instagram_url"),
      avalado: esSi(v("avalado")),
      selloMarca: esSi(v("sello_marca")),
      emprendimientoVerde: esSi(v("emprendimiento_verde")),
      destacado: esSi(v("destacado")),
      activo: esSi(v("activo")),
      categoriaId: categoriaIds[0],
      categoriaIds,
      subcategoriaIds: resolver(v("subcategorias"), catalogo.subcategorias, "Subcategoría", errores),
      actividadIds: resolver(v("actividades_productivas"), catalogo.actividades, "Actividad", errores),
    };
    const val = validarNegocio(entrada, { negocioId: null });
    errores.push(...val.errores);
    const id = v("id");
    return { fila: i + 2, id: /^[0-9a-f-]{36}$/i.test(id) ? id : null, slug: v("slug") || null, datos: errores.length === 0 ? val.datos : null, errores };
  });
  return { filas, errorGeneral: null };
}

const MUNICIPIOS_SIN_TILDE: Record<string, string> = {
  giron: "Girón",
  surata: "Suratá",
  "el playon": "El Playón",
};

/** «GIRON», «girón» o «Giron» → «Girón». */
function municipioCanonico(m: string): string {
  const n = normalizarTexto(m);
  if (MUNICIPIOS_SIN_TILDE[n]) return MUNICIPIOS_SIN_TILDE[n]!;
  return n
    .split(" ")
    .map((p) => (p === "el" ? "El" : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}
