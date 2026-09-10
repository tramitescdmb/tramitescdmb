import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Mail, ShieldCheck, ExternalLink, HelpCircle } from "lucide-react";
import { CorrespondenciaTabs } from "@/components/CorrespondenciaTabs";
import { MigaSgdea } from "@/components/sgdea/Miga";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar, puedeDistribuir, puedeAdministrarArchivo } from "@/lib/permisos";
import { fondoHistoricoConfigurado } from "@/lib/fondo-historico";
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
    distribuir: puedeDistribuir(permisos),
    admin: puedeAdministrarArchivo(permisos),
    fondoHistorico: fondoHistoricoConfigurado(),
  };

  return (
    <div className="space-y-4">
      <a
        href="#contenido-sgdea"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-cdmb-700 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>
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
          <Link
            href="/correspondencia/ayuda"
            aria-label="Ayuda — documento de referencia técnica del SGDEA"
            className="ml-auto flex flex-none items-center gap-1.5 rounded-md border border-cdmb-200 bg-white px-2.5 py-1 text-xs font-semibold text-cdmb-700 shadow-sm transition hover:border-cdmb-400 hover:bg-cdmb-50"
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Ayuda
          </Link>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Sistema de Gestión de Documentos Electrónicos de Archivo — Acuerdo Único de la Función Archivística
          (Acuerdo 001/2024 AGN) y Acuerdo 060/2001 AGN.
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
          <a
            href="https://claude.ai/code/artifact/bdfae6f0-2c31-4a2d-972a-85c4f457f5e9"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Manual de demostración
          </a>
        </div>
      </div>

      <CorrespondenciaTabs permitido={permitido} />

      <MigaSgdea />

      <div id="contenido-sgdea">{children}</div>
    </div>
  );
}
