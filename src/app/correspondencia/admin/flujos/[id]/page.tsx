import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarFlujosModulo } from "@/lib/flujos-modulos";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { EditorFlujo } from "@/components/flujos/EditorFlujo";

export default async function FlujoEditorPage({
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
  if (!puedeAdministrarFlujosModulo(permisos, "SGDEA")) {
    await registrarAccesoDenegadoSeccion("Flujos de trabajo", session, await headers());
    redirect("/correspondencia");
  }
  const sp = await searchParams;
  return <EditorFlujo id={id} modulo="SGDEA" ok={sp.ok} error={sp.error} />;
}
