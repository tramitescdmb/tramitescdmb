import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { TituloSeccion } from "@/components/sgdea/ui";
import { NuevoContratistaForm } from "@/components/NuevoContratistaForm";

export default async function NuevoContratistaPage({
  searchParams,
}: {
  searchParams: Promise<{ identificacion?: string; retorno?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) redirect("/contratacion/contratistas");
  const { identificacion, retorno } = await searchParams;
  const vuelveAlExpediente = retorno === "expediente";

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <Link href={vuelveAlExpediente ? "/contratacion/expedientes/nuevo" : "/contratacion/contratistas"} className="text-sm text-cdmb-700 hover:underline">
        {vuelveAlExpediente ? "← Volver al expediente en creación" : "← Contratistas"}
      </Link>
      <TituloSeccion icon={UserPlus}>Nuevo contratista</TituloSeccion>
      <NuevoContratistaForm identificacionInicial={identificacion?.trim() ?? ""} volverAlExpediente={vuelveAlExpediente} />
    </section>
  );
}
