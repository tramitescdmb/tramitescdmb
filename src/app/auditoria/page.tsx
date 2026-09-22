import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AuditoriaCuentas } from "@/components/admin/AuditoriaCuentas";
import { AccesoRestringido } from "@/components/AccesoRestringido";

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Auditoría de cuentas" volverHref="/" volverLabel="Ir al inicio" />;

  const { tipo } = await searchParams;
  return <AuditoriaCuentas tipo={tipo} basePath="/auditoria" incluirTramites />;
}
