import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { catalogosFormularioNV } from "@/lib/negocios-verdes-admin";
import { FormNegocioNV } from "@/components/negocios-verdes/FormNegocioNV";

export const dynamic = "force-dynamic";

export default async function NuevoNegocioNV() {
  const session = await verificarSesion();
  if (!session || !puedeGestionarNV(await obtenerPermisosUsuario(session.userId), "CREAR")) redirect("/negocios-verdes/admin");
  const catalogos = await catalogosFormularioNV();
  return (
    <div className="space-y-4">
      <Link prefetch={false} href="/negocios-verdes/admin" className="text-sm font-medium text-emerald-700 hover:underline">
        ← Negocios
      </Link>
      <h2 className="text-lg font-semibold text-stone-900">Nuevo negocio</h2>
      <FormNegocioNV negocio={null} catalogos={catalogos} puedeEliminar={false} />
    </div>
  );
}
