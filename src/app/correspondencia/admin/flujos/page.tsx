import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarFlujosModulo } from "@/lib/flujos-modulos";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { ListaFlujos } from "@/components/flujos/ListaFlujos";

export default async function FlujosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, "SGDEA")) {
    await registrarAccesoDenegadoSeccion("Flujos de trabajo", session, await headers());
    redirect("/correspondencia");
  }
  const sp = await searchParams;
  return <ListaFlujos modulo="SGDEA" ok={sp.ok} error={sp.error} />;
}
