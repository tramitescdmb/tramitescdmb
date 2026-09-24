import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarSigec } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { SeguridadFormulario } from "@/components/admin/SeguridadFormulario";
import { AccesoRestringido } from "@/components/AccesoRestringido";

export default async function SeguridadSigecPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarSigec(permisos)) {
    return <AccesoRestringido titulo="Seguridad" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const sp = await searchParams;
  const config = await getConfiguracionSitio();
  return <SeguridadFormulario config={config} volver="/contratacion/seguridad" ok={sp.ok} error={sp.error} />;
}
