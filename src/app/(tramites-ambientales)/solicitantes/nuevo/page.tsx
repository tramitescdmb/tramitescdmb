import Link from "next/link";
import { redirect } from "next/navigation";
import { NuevoSolicitanteForm } from "@/components/NuevoSolicitanteForm";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";

export default async function NuevoSolicitantePage() {
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSolicitantes(permisos)) redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/solicitantes" className="text-sm text-cdmb-700 hover:underline">
          ← Solicitantes
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Nuevo solicitante</h1>
        <p className="text-sm text-stone-500">
          Permite registrar un NIT o cédula antes de que llegue su primer trámite. Al radicar un
          expediente, la búsqueda por esta identificación completa automáticamente estos datos.
        </p>
      </div>

      <NuevoSolicitanteForm />
    </div>
  );
}
