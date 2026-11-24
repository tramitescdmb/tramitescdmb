import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { MUNICIPIOS_NV, SELECT_NEGOCIO_PUBLICO, aNegocioPublico, urlImagenNV, type NegocioPublico } from "@/lib/negocios-verdes";

export const ETIQUETA_CACHE_NV = "negocios-verdes-publico";

/**
 * Negocios publicados, ya convertidos a su forma pública. Son unos 300: se leen todos de una vez
 * (en caché un minuto) y el filtro se aplica en memoria, sin tildes.
 */
export const listarNegociosPublicos = unstable_cache(
  async (): Promise<NegocioPublico[]> => {
    const filas = await db.nvNegocio.findMany({ where: { activo: true }, select: SELECT_NEGOCIO_PUBLICO, orderBy: { nombre: "asc" } });
    return filas.map(aNegocioPublico);
  },
  ["nv-negocios-publicos"],
  { revalidate: 60, tags: [ETIQUETA_CACHE_NV] }
);

export async function negocioPublicoPorSlug(slug: string): Promise<NegocioPublico | null> {
  const fila = await db.nvNegocio.findFirst({ where: { slug, activo: true }, select: SELECT_NEGOCIO_PUBLICO });
  return fila ? aNegocioPublico(fila) : null;
}

export type OpcionFiltro = { valor: string; nombre: string; cantidad: number };

/** Opciones de los filtros del buscador, contadas sobre los negocios publicados (sin opciones vacías). */
export function opcionesFiltroNV(negocios: NegocioPublico[]) {
  const contar = (claves: [string, string][]) => {
    const m = new Map<string, OpcionFiltro>();
    for (const [valor, nombre] of claves) {
      const o = m.get(valor) ?? { valor, nombre, cantidad: 0 };
      o.cantidad++;
      m.set(valor, o);
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  };
  const municipios = MUNICIPIOS_NV.map((m) => ({ valor: m, nombre: m, cantidad: negocios.filter((n) => n.municipio === m).length })).filter((o) => o.cantidad > 0);
  return {
    municipios,
    categorias: contar(negocios.flatMap((n) => n.categorias.map((c) => [c.slug, c.nombre] as [string, string]))),
  };
}

export const configuracionPublicaNV = unstable_cache(
  async () => {
    const [config, banners] = await Promise.all([
      db.nvConfiguracion.findUnique({ where: { id: "singleton" } }),
      db.nvBanner.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, select: { id: true, imagenRuta: true, urlDestino: true, abrirEnPestanaNueva: true } }),
    ]);
    return {
      logoUrl: urlImagenNV(config?.logoRuta),
      logosPie: [
        { url: urlImagenNV(config?.logoColombiaRuta), alt: "Colombia" },
        { url: urlImagenNV(config?.logoPotenciaRuta), alt: "Colombia potencia de la vida" },
        { url: urlImagenNV(config?.logoGovcoRuta), alt: "GOV.CO" },
      ].filter((l): l is { url: string; alt: string } => Boolean(l.url)),
      banners: banners.map((b) => ({ id: b.id, imagenUrl: urlImagenNV(b.imagenRuta), urlDestino: b.urlDestino, abrirEnPestanaNueva: b.abrirEnPestanaNueva })),
    };
  },
  ["nv-configuracion-publica"],
  { revalidate: 60, tags: [ETIQUETA_CACHE_NV] }
);

/** Cifras del tablero del panel interno. */
export async function resumenPanelNV() {
  const [total, publicados, porMunicipio, categorias, personas, sinCoordenadas] = await Promise.all([
    db.nvNegocio.count(),
    db.nvNegocio.count({ where: { activo: true } }),
    db.nvNegocio.groupBy({ by: ["municipio"], _count: { _all: true } }),
    db.nvCategoria.count({ where: { activo: true } }),
    db.nvPersona.count(),
    db.nvNegocio.count({ where: { OR: [{ latitud: null }, { longitud: null }] } }),
  ]);
  return {
    total,
    publicados,
    borradores: total - publicados,
    categorias,
    personas,
    sinCoordenadas,
    porMunicipio: porMunicipio.map((m) => ({ municipio: m.municipio, cantidad: m._count._all })).sort((a, b) => b.cantidad - a.cantidad),
  };
}

export async function listarNegociosPanel(filtro: { q?: string; municipio?: string; estado?: "publicados" | "borradores" }) {
  const q = filtro.q?.trim();
  return db.nvNegocio.findMany({
    where: {
      ...(filtro.municipio ? { municipio: filtro.municipio } : {}),
      ...(filtro.estado === "publicados" ? { activo: true } : filtro.estado === "borradores" ? { activo: false } : {}),
      ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      municipio: true,
      activo: true,
      destacado: true,
      actualizadoEn: true,
      categoria: { select: { nombre: true } },
      _count: { select: { productos: true, fotos: true } },
    },
    orderBy: { nombre: "asc" },
    take: 500,
  });
}

export type NodoTaxonomiaNV = { id: string; nombre: string; slug: string; icono: string | null; iconoUrl: string | null };
export type CategoriaPublicaNV = NodoTaxonomiaNV & { subcategorias: (NodoTaxonomiaNV & { actividades: NodoTaxonomiaNV[] })[] };

/** Clasificación activa (categoría → subcategoría → actividad), para los filtros del inicio y del buscador. */
export const taxonomiaPublicaNV = unstable_cache(
  async (): Promise<CategoriaPublicaNV[]> => {
    const nodo = { id: true, nombre: true, slug: true, icono: true, iconoRuta: true } as const;
    const orden = [{ orden: "asc" as const }, { nombre: "asc" as const }];
    const filas = await db.nvCategoria.findMany({
      where: { activo: true },
      orderBy: orden,
      select: {
        ...nodo,
        subcategorias: {
          where: { activo: true },
          orderBy: orden,
          select: { ...nodo, actividades: { where: { activo: true }, orderBy: orden, select: nodo } },
        },
      },
    });
    const n = <T extends { iconoRuta: string | null }>({ iconoRuta, ...r }: T) => ({ ...r, iconoUrl: urlImagenNV(iconoRuta) });
    return filas.map((c) => ({ ...n(c), subcategorias: c.subcategorias.map((s) => ({ ...n(s), actividades: s.actividades.map(n) })) })) as CategoriaPublicaNV[];
  },
  ["nv-taxonomia-publica"],
  { revalidate: 60, tags: [ETIQUETA_CACHE_NV] }
);
