import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarSigec } from "@/lib/permisos";
import { AuditoriaCuentas } from "@/components/admin/AuditoriaCuentas";
import { AccesoRestringido } from "@/components/AccesoRestringido";

/** Auditoría de cuentas dentro de SIGEC — el mismo registro que en el resto de la aplicación, sin la
 * actividad de otros módulos; visible para el Administrador y el Jefe de Contratación. */
export default async function AuditoriaSigecPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarSigec(permisos)) {
    return <AccesoRestringido titulo="Auditoría de cuentas" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const { tipo } = await searchParams;
  return <AuditoriaCuentas tipo={tipo} basePath="/contratacion/auditoria" incluirTramites={false} />;
}
