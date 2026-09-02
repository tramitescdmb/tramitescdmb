import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { EditarUsuarioAccesoForm } from "@/components/EditarUsuarioAccesoForm";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { id } = await params;
  const [usuario, cargos, tramites] = await Promise.all([
    db.usuario.findUnique({
      where: { id },
      include: { cargos: true, tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } } },
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    getCatalogoTramites(),
  ]);
  if (!usuario) notFound();

  const tramitesPorCategoria = agruparTramitesPorCategoria(tramites).map((g) => ({
    etiqueta: g.etiqueta,
    items: g.items.map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre })),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/usuarios" className="text-sm text-cdmb-700 hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">
          Editar a {usuario.nombre}
          {usuario.directorioActivo && (
            <span className="ml-2 rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700 align-middle">
              Directorio activo
            </span>
          )}
        </h1>
        <p className="text-sm text-stone-500">{usuario.email}</p>
      </div>

      <EditarUsuarioAccesoForm
        usuarioId={usuario.id}
        rolActual={usuario.rol}
        cargoActualIds={usuario.cargos.map((c) => c.id)}
        accesoActual={usuario.tramitesAcceso.map((a) => ({ tramiteTipoId: a.tramiteTipoId, nivel: a.nivel }))}
        cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
        tramitesPorCategoria={tramitesPorCategoria}
      />
    </div>
  );
}
