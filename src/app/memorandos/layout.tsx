import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { FileEdit, ShieldCheck } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contarMemorandos, contextoMemorandos } from "@/lib/memorandos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { MemorandosTabs } from "@/components/memorandos/MemorandosTabs";

export default async function MemorandosLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  if (!ctx.acceso) {
    const { ip, userAgent } = datosPeticion(await headers());
    await registrarAuditoriaDoc({
      entidad: "Acceso",
      entidadId: "memorandos",
      accion: "ACCESO_DENEGADO",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `${session.nombre} intentó entrar al módulo de memorandos sin dependencia asignada o con el módulo oculto`,
    });
    redirect("/");
  }
  const conteo = await contarMemorandos(ctx);

  return (
    <div className="space-y-4">
      <div className="encabezado-modulo">
        <div className="flex flex-wrap items-center gap-2">
          <FileEdit className="h-6 w-6 flex-none text-cdmb-600" aria-hidden />
          <h1 className="text-xl font-semibold text-stone-900">Memorandos</h1>
          <span className="flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Firma electrónica
          </span>
        </div>
      </div>
      <div className="encabezado-modulo">
        <MemorandosTabs conteo={conteo} puedeEnviar={ctx.firmante} />
      </div>
      <div>{children}</div>
    </div>
  );
}
