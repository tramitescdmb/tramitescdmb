/**
 * Negocios Verdes: reglas puras (sin base de datos) del sitio público y del panel interno.
 *
 * Regla de seguridad del módulo: el sitio público solo recibe lo que arma `aNegocioPublico`.
 * Nunca viajan al navegador la ficha técnica (NIT, permisos, fortalezas…), los puntajes, las
 * personas vinculadas ni los negocios no publicados.
 */

/** Almacén público del NAS donde viven las imágenes del módulo (portadas, galería, productos, banners, íconos). */
export const BUCKET_NEGOCIOS_VERDES = "negocios-verdes";

/**
 * Rutas del sitio público de Negocios Verdes: todo /negocios-verdes salvo el panel interno
 * (/negocios-verdes/admin), que exige sesión como el resto del SIC.
 */
export function esSitioPublicoNV(pathname: string): boolean {
  const panel = pathname === "/negocios-verdes/admin" || pathname.startsWith("/negocios-verdes/admin/");
  return !panel && (pathname === "/negocios-verdes" || pathname.startsWith("/negocios-verdes/"));
}

/** Los 13 municipios de la jurisdicción de la CDMB (lista fija, igual que en la plataforma anterior). */
export const MUNICIPIOS_NV = [
  "Bucaramanga",
  "Floridablanca",
  "Girón",
  "Piedecuesta",
  "Vetas",
  "California",
  "Suratá",
  "Matanza",
  "Charta",
  "Tona",
  "El Playón",
  "Rionegro",
  "Lebrija",
] as const;
export type MunicipioNV = (typeof MUNICIPIOS_NV)[number];

export function esMunicipioNV(valor: unknown): valor is MunicipioNV {
  return typeof valor === "string" && (MUNICIPIOS_NV as readonly string[]).includes(valor);
}

/** Minúsculas y sin tildes, para buscar «giron» y encontrar «Girón». */
export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug a partir de un nombre: «Café La Montaña» → «cafe-la-montana». */
export function slugNV(texto: string): string {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Ruta pública (relativa) de una imagen guardada en el almacén del módulo. */
export function urlImagenNV(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  const limpia = ruta.replace(/^\/+/, "");
  if (!limpia || limpia.split("/").some((s) => s === ".." || s === ".")) return null;
  return `/api/almacen/${BUCKET_NEGOCIOS_VERDES}/${limpia.split("/").map(encodeURIComponent).join("/")}`;
}

/** Enlace de WhatsApp (wa.me) a partir de un número colombiano escrito de cualquier forma. */
export function enlaceWhatsapp(numero: string | null | undefined, mensaje?: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length < 7) return null;
  const completo = digitos.length === 10 && digitos.startsWith("3") ? `57${digitos}` : digitos;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${completo}${texto}`;
}

/** Solo se enlazan direcciones web http(s); cualquier otra cosa (javascript:, data:…) se descarta. */
export function urlExternaSegura(url: string | null | undefined): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conEsquema);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ─── Lo que ve la ciudadanía ────────────────────────────────────────────────

export type TaxonomiaPublica = { id: string; nombre: string; slug: string; icono: string | null; iconoUrl: string | null };

export type ProductoPublico = { orden: number; nombre: string | null; descripcion: string | null; fotoUrl: string | null };

export type NegocioPublico = {
  id: string;
  nombre: string;
  slug: string;
  municipio: string;
  vereda: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  descripcionCorta: string | null;
  descripcion: string | null;
  producto: string | null;
  telefono: string | null;
  telefonoSecundario: string | null;
  whatsapp: string | null;
  email: string | null;
  sitioWeb: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  fotoPortadaUrl: string | null;
  representanteLegal: string | null;
  emprendimientoVerde: boolean;
  selloMarca: boolean;
  avalado: boolean;
  destacado: boolean;
  categoria: TaxonomiaPublica;
  categorias: TaxonomiaPublica[];
  subcategorias: TaxonomiaPublica[];
  actividades: TaxonomiaPublica[];
  productos: ProductoPublico[];
  fotos: string[];
};

/** Campos que la consulta pública pide a la base: lista explícita, nunca «todo». */
export const SELECT_NEGOCIO_PUBLICO = {
  id: true,
  nombre: true,
  slug: true,
  municipio: true,
  direccion: true,
  latitud: true,
  longitud: true,
  descripcionCorta: true,
  descripcion: true,
  producto: true,
  telefono: true,
  telefonoSecundario: true,
  whatsapp: true,
  email: true,
  sitioWeb: true,
  facebookUrl: true,
  instagramUrl: true,
  fotoPortadaRuta: true,
  representanteLegal: true,
  emprendimientoVerde: true,
  selloMarca: true,
  avalado: true,
  destacado: true,
  activo: true,
  vereda: { select: { nombre: true } },
  categoria: { select: { id: true, nombre: true, slug: true, icono: true, iconoRuta: true, activo: true } },
  categorias: { select: { categoria: { select: { id: true, nombre: true, slug: true, icono: true, iconoRuta: true, activo: true, orden: true } } } },
  subcategorias: { select: { subcategoria: { select: { id: true, nombre: true, slug: true, icono: true, iconoRuta: true, activo: true, orden: true } } } },
  actividades: { select: { actividad: { select: { id: true, nombre: true, slug: true, icono: true, iconoRuta: true, activo: true, orden: true } } } },
  productos: { select: { orden: true, nombre: true, descripcion: true, fotoRuta: true }, orderBy: { orden: "asc" as const } },
  fotos: { select: { ruta: true, orden: true }, orderBy: { orden: "asc" as const } },
} as const;

type TaxonomiaFila = { id: string; nombre: string; slug: string; icono: string | null; iconoRuta: string | null; activo: boolean; orden?: number };

export type FilaNegocioPublico = {
  id: string;
  nombre: string;
  slug: string;
  municipio: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  descripcionCorta: string | null;
  descripcion: string | null;
  producto: string | null;
  telefono: string | null;
  telefonoSecundario: string | null;
  whatsapp: string | null;
  email: string | null;
  sitioWeb: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  fotoPortadaRuta: string | null;
  representanteLegal: string | null;
  emprendimientoVerde: boolean;
  selloMarca: boolean;
  avalado: boolean;
  destacado: boolean;
  activo: boolean;
  vereda: { nombre: string } | null;
  categoria: TaxonomiaFila;
  categorias: { categoria: TaxonomiaFila }[];
  subcategorias: { subcategoria: TaxonomiaFila }[];
  actividades: { actividad: TaxonomiaFila }[];
  productos: { orden: number; nombre: string | null; descripcion: string | null; fotoRuta: string | null }[];
  fotos: { ruta: string; orden: number }[];
};

function taxonomia(t: TaxonomiaFila): TaxonomiaPublica {
  return { id: t.id, nombre: t.nombre, slug: t.slug, icono: t.icono, iconoUrl: urlImagenNV(t.iconoRuta) };
}

function activas<T extends TaxonomiaFila>(lista: T[]): TaxonomiaPublica[] {
  return lista
    .filter((t) => t.activo)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, "es"))
    .map(taxonomia);
}

/**
 * Convierte una fila de la base en lo que se entrega al sitio público. Se arma campo por campo a
 * propósito: si la fila trae algo más (por error en la consulta), no pasa.
 */
export function aNegocioPublico(f: FilaNegocioPublico): NegocioPublico {
  const categorias = activas(f.categorias.map((c) => c.categoria));
  return {
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    municipio: f.municipio,
    vereda: f.vereda?.nombre ?? null,
    direccion: f.direccion,
    latitud: f.latitud,
    longitud: f.longitud,
    descripcionCorta: f.descripcionCorta,
    descripcion: f.descripcion,
    producto: f.producto,
    telefono: f.telefono,
    telefonoSecundario: f.telefonoSecundario,
    whatsapp: f.whatsapp,
    email: f.email,
    sitioWeb: urlExternaSegura(f.sitioWeb),
    facebookUrl: urlExternaSegura(f.facebookUrl),
    instagramUrl: urlExternaSegura(f.instagramUrl),
    fotoPortadaUrl: urlImagenNV(f.fotoPortadaRuta),
    representanteLegal: f.representanteLegal,
    emprendimientoVerde: f.emprendimientoVerde,
    selloMarca: f.selloMarca,
    avalado: f.avalado,
    destacado: f.destacado,
    categoria: taxonomia(f.categoria),
    // La categoría comodín «Pendiente de clasificar» está inactiva: no se ofrece como filtro.
    categorias: categorias.length > 0 ? categorias : f.categoria.activo ? [taxonomia(f.categoria)] : [],
    subcategorias: activas(f.subcategorias.map((s) => s.subcategoria)),
    actividades: activas(f.actividades.map((a) => a.actividad)),
    productos: f.productos
      .filter((p) => p.nombre || p.descripcion || p.fotoRuta)
      .map((p) => ({ orden: p.orden, nombre: p.nombre, descripcion: p.descripcion, fotoUrl: urlImagenNV(p.fotoRuta) })),
    fotos: f.fotos.map((x) => urlImagenNV(x.ruta)).filter((u): u is string => Boolean(u)),
  };
}

// ─── Búsqueda ───────────────────────────────────────────────────────────────

export type FiltroNV = {
  q?: string;
  municipio?: string;
  categoria?: string;
  subcategoria?: string;
  actividad?: string;
  reconocimiento?: "avalado" | "sello" | "emprendimiento";
};

const RECONOCIMIENTOS = new Set(["avalado", "sello", "emprendimiento"]);

/** Lee el filtro de la dirección (?q=&municipio=…) descartando valores no válidos. */
export function leerFiltroNV(sp: Record<string, string | string[] | undefined>): FiltroNV {
  const uno = (k: string) => {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 120) : undefined;
  };
  const municipio = uno("municipio");
  const reconocimiento = uno("reconocimiento");
  return {
    q: uno("q"),
    municipio: esMunicipioNV(municipio) ? municipio : undefined,
    categoria: uno("categoria"),
    subcategoria: uno("subcategoria"),
    actividad: uno("actividad"),
    reconocimiento: reconocimiento && RECONOCIMIENTOS.has(reconocimiento) ? (reconocimiento as FiltroNV["reconocimiento"]) : undefined,
  };
}

function textoBuscable(n: NegocioPublico): string {
  return normalizarTexto(
    [
      n.nombre,
      n.descripcionCorta,
      n.descripcion,
      n.producto,
      n.municipio,
      n.vereda,
      ...n.categorias.map((c) => c.nombre),
      ...n.subcategorias.map((s) => s.nombre),
      ...n.actividades.map((a) => a.nombre),
      ...n.productos.map((p) => `${p.nombre ?? ""} ${p.descripcion ?? ""}`),
    ].join(" ")
  );
}

/**
 * Aplica el filtro (todas las condiciones a la vez). El texto se busca por palabras, sin tildes ni
 * mayúsculas: «cafe giron» encuentra «Café de Girón». Orden: destacados primero y luego por nombre.
 */
export function filtrarNegociosNV(lista: NegocioPublico[], filtro: FiltroNV): NegocioPublico[] {
  const palabras = normalizarTexto(filtro.q).split(" ").filter(Boolean);
  return lista
    .filter((n) => {
      if (filtro.municipio && n.municipio !== filtro.municipio) return false;
      if (filtro.categoria && !n.categorias.some((c) => c.slug === filtro.categoria)) return false;
      if (filtro.subcategoria && !n.subcategorias.some((s) => s.slug === filtro.subcategoria)) return false;
      if (filtro.actividad && !n.actividades.some((a) => a.slug === filtro.actividad)) return false;
      if (filtro.reconocimiento === "avalado" && !n.avalado) return false;
      if (filtro.reconocimiento === "sello" && !n.selloMarca) return false;
      if (filtro.reconocimiento === "emprendimiento" && !n.emprendimientoVerde) return false;
      if (palabras.length > 0) {
        const texto = textoBuscable(n);
        if (!palabras.every((p) => texto.includes(p))) return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.nombre.localeCompare(b.nombre, "es"));
}

export const POR_PAGINA_NV = 24;

export function paginar<T>(lista: T[], pagina: number, porPagina = POR_PAGINA_NV): { items: T[]; pagina: number; paginas: number; total: number } {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  return { items: lista.slice((p - 1) * porPagina, p * porPagina), pagina: p, paginas, total: lista.length };
}
