import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { RolForm } from "@/components/RolForm";

export default async function NuevoRolPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const tramites = await getCatalogoTramites();
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
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Crear rol</h1>
      </div>

      <RolForm
        modo="crear"
        valoresIniciales={{ nombre: "", descripcion: "", todosLosTramites: true, tramiteIds: [], activo: true }}
        tramitesPorCategoria={tramitesPorCategoria}
      />
    </div>
  );
}
