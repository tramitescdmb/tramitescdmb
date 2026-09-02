import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { RolForm } from "@/components/RolForm";

export default async function EditarRolPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { id } = await params;
  const [rol, tramites] = await Promise.all([
    db.rol.findUnique({ where: { id }, include: { tramites: { select: { tramiteTipoId: true } } } }),
    getCatalogoTramites(),
  ]);
  if (!rol) notFound();

  const tramitesPorCategoria = agruparTramitesPorCategoria(tramites).map((g) => ({
    etiqueta: g.etiqueta,
    items: g.items.map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre })),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/roles" className="text-sm text-cdmb-700 hover:underline">
          ← Roles
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Editar rol: {rol.nombre}</h1>
      </div>

      <RolForm
        modo="editar"
        rolId={rol.id}
        valoresIniciales={{
          nombre: rol.nombre,
          descripcion: rol.descripcion ?? "",
          todosLosTramites: rol.todosLosTramites,
          tramiteIds: rol.tramites.map((t) => t.tramiteTipoId),
          activo: rol.activo,
        }}
        tramitesPorCategoria={tramitesPorCategoria}
      />
    </div>
  );
}
