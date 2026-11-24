import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ExternalLink, Leaf } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV } from "@/lib/negocios-verdes-permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export const metadata: Metadata = { title: "Negocios Verdes — SIC CDMB" };

/** Panel interno de Negocios Verdes: solo funcionarios con perfil del módulo (y el administrador del SIC). */
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

  return (
    <div className="space-y-4">
      <div className="encabezado-modulo flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 flex-none text-emerald-600" aria-hidden />
          <h1 className="text-xl font-semibold text-stone-900">Negocios Verdes</h1>
        </div>
        <Link prefetch={false} href="/negocios-verdes" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
          Ver sitio público <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div>{children}</div>
    </div>
  );
}
