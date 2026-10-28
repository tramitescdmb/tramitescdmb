import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarFlujosModulo } from "@/lib/flujos-modulos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { ListaFlujos } from "@/components/flujos/ListaFlujos";

export default async function FlujosGeconPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, "GECON")) {
    return <AccesoRestringido titulo="Flujos de trabajo" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver a GECON" />;
  }
  const sp = await searchParams;
  return <ListaFlujos modulo="GECON" ok={sp.ok} error={sp.error} />;
}
