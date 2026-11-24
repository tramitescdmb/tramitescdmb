import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeConfigurarNV } from "@/lib/negocios-verdes-permisos";
import { urlImagenNV } from "@/lib/negocios-verdes";
import type { NodoAdminNV, PadreNV } from "@/components/negocios-verdes/admin/TaxonomiaNV";

type Fila = { id: string; nombre: string; slug: string; icono: string | null; iconoRuta: string | null; orden: number; activo: boolean };
const orden = [{ orden: "asc" as const }, { nombre: "asc" as const }];

function nodo(t: Fila, extra: { descripcion?: string | null; categoriaNacional?: string | null; padreId: string | null; padre: string; usos: number }): NodoAdminNV {
  return {
    id: t.id,
    nombre: t.nombre,
    slug: t.slug,
    icono: t.icono ?? "",
    iconoUrl: urlImagenNV(t.iconoRuta),
    orden: t.orden,
    activo: t.activo,
    descripcion: extra.descripcion ?? "",
    categoriaNacional: extra.categoriaNacional ?? "",
    padreId: extra.padreId,
    padre: extra.padre,
    usos: extra.usos,
  };
}

/** Datos de las páginas Categorías, Subcategorías y Actividades productivas (perfil de configuración). */
export async function taxonomiaAdminNV(nivel: "categoria" | "subcategoria" | "actividad"): Promise<{ nodos: NodoAdminNV[]; padres: PadreNV[] }> {
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  if (!permisos || !puedeConfigurarNV(permisos)) notFound();
  if (nivel === "categoria") {
    const c = await db.nvCategoria.findMany({ orderBy: orden, include: { _count: { select: { negocios: true } } } });
    return { nodos: c.map((x) => nodo(x, { descripcion: x.descripcion, categoriaNacional: x.categoriaNacional, padreId: null, padre: "", usos: x._count.negocios })), padres: [] };
  }
  const categorias = await db.nvCategoria.findMany({ orderBy: orden, select: { id: true, nombre: true, icono: true } });
  if (nivel === "subcategoria") {
    const s = await db.nvSubcategoria.findMany({ orderBy: orden, include: { categoria: { select: { nombre: true } }, _count: { select: { negocios: true } } } });
    return {
      nodos: s.map((x) => nodo(x, { padreId: x.categoriaId, padre: x.categoria.nombre, usos: x._count.negocios })),
      padres: categorias.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono ?? "" })),
    };
  }
  const [a, subs] = await Promise.all([
    db.nvActividad.findMany({ orderBy: orden, include: { subcategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } }, _count: { select: { negocios: true } } } }),
    db.nvSubcategoria.findMany({ orderBy: orden, select: { id: true, nombre: true, icono: true, categoria: { select: { nombre: true } } } }),
  ]);
  return {
    nodos: a.map((x) => nodo(x, { descripcion: x.descripcion, padreId: x.subcategoriaId, padre: `${x.subcategoria.categoria.nombre} › ${x.subcategoria.nombre}`, usos: x._count.negocios })),
    padres: subs.map((s) => ({ id: s.id, nombre: s.nombre, icono: s.icono ?? "", grupo: s.categoria.nombre })),
  };
}
