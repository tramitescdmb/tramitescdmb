import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Mail, ShieldCheck, ExternalLink } from "lucide-react";
import { CorrespondenciaTabs } from "@/components/CorrespondenciaTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/**
 * Módulo de Correspondencia y Gestión Documental (SGDEA). Denegado por defecto:
 * requiere un rol de correspondencia asignado (o ser ADMIN). Ver src/lib/permisos.ts.
 */
export default async function CorrespondenciaLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    // MoReq 6.9: registrar el intento de entrar a un módulo sin permiso.
    const { ip, userAgent } = datosPeticion(await headers());
    await registrarAuditoriaDoc({
      entidad: "Acceso",
      entidadId: "correspondencia",
      accion: "ACCESO_DENEGADO",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `${session.nombre} intentó entrar al módulo de correspondencia sin tener un rol asignado`,
    });
    redirect("/");
  }

  const permitido = {
    bandeja: true,
    expedientes: puedeAccederCorrespondencia(permisos),
    radicar: puedeRadicar(permisos),
    admin: puedeAdministrarArchivo(permisos),
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">SGDEA — Correspondencia y Archivo</h1>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Radicado inalterable
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Sistema de Gestión de Documentos Electrónicos de Archivo, conforme al Acuerdo Único de la Función
          Archivística (Acuerdo 001/2024 AGN) y al Acuerdo 060/2001 del AGN. La correspondencia es solo una de las
          formas en que un documento entra al archivo — en <strong>Expedientes</strong> cualquier dependencia puede
          abrir y gestionar su propio archivo documental sin que pase por la ventanilla. Toda acción queda en una
          bitácora de auditoría inalterable.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href="/pqrsd"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Ver formulario público de PQRSD
          </a>
          <a
            href="https://claude.ai/code/artifact/d14c3aa6-f64f-4fe1-9db9-64ee523f80e0"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Matriz de cumplimiento MoReq/AGN
          </a>
        </div>
      </div>

      <CorrespondenciaTabs permitido={permitido} />

      {children}
    </div>
  );
}
