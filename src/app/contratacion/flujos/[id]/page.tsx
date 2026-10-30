import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarFlujosModulo } from "@/lib/flujos-modulos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { EditorFlujo } from "@/components/flujos/EditorFlujo";

export default async function FlujoGeconPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; pestana?: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, "GECON")) {
    return <AccesoRestringido titulo="Flujos de trabajo" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver a GECON" />;
  }
  const sp = await searchParams;
  return <EditorFlujo id={id} modulo="GECON" ok={sp.ok} error={sp.error} pestana={sp.pestana} />;
}
