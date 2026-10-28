import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarFlujosModulo } from "@/lib/flujos-modulos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { EditorFlujo } from "@/components/flujos/EditorFlujo";

export default async function FlujoTramitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, "TRAMITES")) {
    return <AccesoRestringido titulo="Flujos de trabajo" quien="Subdirector(a) SEYCA o administrador" volverHref="/tramites-ambientales" volverLabel="Volver a Trámites" />;
  }
  const sp = await searchParams;
  return <EditorFlujo id={id} modulo="TRAMITES" ok={sp.ok} error={sp.error} />;
}
