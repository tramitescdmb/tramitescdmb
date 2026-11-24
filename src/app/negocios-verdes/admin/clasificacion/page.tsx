import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeConfigurarNV } from "@/lib/negocios-verdes-permisos";
import { ClasificacionNV } from "@/components/negocios-verdes/ClasificacionNV";

export const dynamic = "force-dynamic";

export default async function ClasificacionNegociosVerdes() {
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  if (!permisos || !puedeConfigurarNV(permisos)) notFound();
  const orden = [{ orden: "asc" as const }, { nombre: "asc" as const }];
  const categorias = await db.nvCategoria.findMany({
    orderBy: orden,
    include: {
      _count: { select: { negocios: true } },
      subcategorias: {
        orderBy: orden,
        include: { _count: { select: { negocios: true } }, actividades: { orderBy: orden, include: { _count: { select: { negocios: true } } } } },
      },
    },
  });
  const base = (t: { id: string; nombre: string; slug: string; icono: string | null; orden: number; activo: boolean; _count: { negocios: number } }) => ({
    id: t.id,
    nombre: t.nombre,
    slug: t.slug,
    icono: t.icono ?? "",
    orden: t.orden,
    activo: t.activo,
    usos: t._count.negocios,
  });
  return (
    <ClasificacionNV
      categorias={categorias.map((c) => ({
        ...base(c),
        descripcion: c.descripcion ?? "",
        categoriaNacional: c.categoriaNacional ?? "",
        subcategorias: c.subcategorias.map((s) => ({ ...base(s), actividades: s.actividades.map((a) => ({ ...base(a), descripcion: a.descripcion ?? "" })) })),
      }))}
    />
  );
}
