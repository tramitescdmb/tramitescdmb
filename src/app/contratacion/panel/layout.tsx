import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion } from "@/lib/permisos";

export default async function PanelGeconLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  return <div className="space-y-4">{children}</div>;
}
