import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { EditarUsuarioAccesoForm } from "@/components/EditarUsuarioAccesoForm";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { id } = await params;
  const { ok } = await searchParams;
  const [usuario, cargos, tramites] = await Promise.all([
    db.usuario.findUnique({
      where: { id },
      include: {
        cargos: true,
        tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
        seccionesAcceso: { select: { seccion: true } },
      },
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    getCatalogoTramites(),
  ]);
  if (!usuario) notFound();

  const tramitesPorCategoria = agruparTramitesPorCategoria(tramites).map((g) => ({
    etiqueta: g.etiqueta,
    claseBadge: g.clases.badge,
    claseBarra: g.clases.barra,
    items: g.items.map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre })),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/usuarios" className="text-sm text-cdmb-700 hover:underline">
          ← Usuarios
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-cdmb-100 text-sm font-semibold text-cdmb-800">
            {iniciales(usuario.nombre)}
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
              {usuario.nombre}
              {usuario.directorioActivo && (
                <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">
                  Directorio activo
                </span>
              )}
            </h1>
            <p className="text-sm text-stone-500">{usuario.email}</p>
          </div>
        </div>
      </div>

      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <EditarUsuarioAccesoForm
        usuarioId={usuario.id}
        nombreActual={usuario.nombre}
        directorioActivo={usuario.directorioActivo}
        rolActual={usuario.rol}
        cargoActualIds={usuario.cargos.map((c) => c.id)}
        accesoActual={usuario.tramitesAcceso.map((a) => ({ tramiteTipoId: a.tramiteTipoId, nivel: a.nivel }))}
        seccionesActuales={usuario.seccionesAcceso.map((s) => s.seccion)}
        cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
        tramitesPorCategoria={tramitesPorCategoria}
      />
    </div>
  );
}
