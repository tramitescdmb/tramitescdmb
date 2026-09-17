import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { TituloSeccion } from "@/components/sgdea/ui";
import { NuevoContratistaForm } from "@/components/NuevoContratistaForm";

export default async function NuevoContratistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) redirect("/contratacion/contratistas");

  return (
    <section className="max-w-xl space-y-4">
      <Link href="/contratacion/contratistas" className="text-sm text-cdmb-700 hover:underline">
        ← Contratistas
      </Link>
      <TituloSeccion icon={UserPlus}>Nuevo contratista</TituloSeccion>
      <NuevoContratistaForm />
    </section>
  );
}
