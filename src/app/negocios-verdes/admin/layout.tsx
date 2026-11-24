import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV, puedeConfigurarNV } from "@/lib/negocios-verdes-permisos";
import { configuracionPublicaNV } from "@/lib/negocios-verdes-data";
import { LOGO_CDMB_NV } from "@/lib/negocios-verdes-sitio";
import { ShellAdminNV } from "@/components/negocios-verdes/admin/ShellAdminNV";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export const metadata: Metadata = { title: "Administración — Negocios Verdes CDMB" };

/** Administrador de Negocios Verdes (menú y orden de la plataforma anterior): solo funcionarios con perfil del módulo y el administrador del SIC. */
export default async function NegociosVerdesAdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/negocios-verdes/admin");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!accedePanelNV(permisos)) {
    const { ip, userAgent } = datosPeticion(await headers());
    await registrarAuditoriaDoc({
      entidad: "Acceso",
      entidadId: "negocios-verdes",
      accion: "ACCESO_DENEGADO",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `${session.nombre} intentó entrar al panel de Negocios Verdes sin perfil del módulo o con el módulo oculto`,
    });
    redirect("/");
  }

  const nv = await configuracionPublicaNV().catch(() => ({ logoUrl: null }));
  return (
    <ShellAdminNV configurar={puedeConfigurarNV(permisos)} logoUrl={nv.logoUrl ?? LOGO_CDMB_NV}>
      {children}
    </ShellAdminNV>
  );
}
