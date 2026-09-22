import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarSigec } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { SeguridadFormulario } from "@/components/admin/SeguridadFormulario";
import { AccesoRestringido } from "@/components/AccesoRestringido";

/** Seguridad de toda la aplicación. El mismo formulario se monta también dentro de cada módulo
 * (ej. /contratacion/seguridad) para que sus administradores lo usen sin salir de él. */
export default async function SeguridadPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarSigec(permisos)) return <AccesoRestringido titulo="Seguridad" volverHref="/" volverLabel="Ir al inicio" />;

  const sp = await searchParams;
  const config = await getConfiguracionSitio();
  return <SeguridadFormulario config={config} volver="/admin/seguridad" ok={sp.ok} error={sp.error} />;
}
