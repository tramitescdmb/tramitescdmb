import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, PenLine, Lock } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { listarBuzon, contarRechazosPorAtender } from "@/lib/solicitudes-firma";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { rotuloCalidadFirma, resumirPendientesFirma } from "@/lib/calidad-firma";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { RUTAS_FIRMAS_SIGEC } from "@/lib/rutas-firmas";

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Debe dar visto bueno" };

export default async function BuzonContratacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const [solicitudes, rechazosPorAtender] = await Promise.all([
    listarBuzon(session.userId, "documentoContrato"),
    contarRechazosPorAtender(session.userId, puedeGestionarContratistas(permisos), "documentoContrato"),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Inbox}>Buzón de firmas</TituloSeccion>
      <FirmasSubNav pendientes={resumirPendientesFirma(solicitudes)} rechazosPorAtender={rechazosPorAtender} rutas={RUTAS_FIRMAS_SIGEC} />

      {solicitudes.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>
            Tiene {solicitudes.length} documento{solicitudes.length === 1 ? "" : "s"} pendiente{solicitudes.length === 1 ? "" : "s"} por firmar o revisar
          </strong>
          {solicitudes.some((s) => !s.puedeActuar) &&
            ` (${solicitudes.filter((s) => s.puedeActuar).length} ya puede${solicitudes.filter((s) => s.puedeActuar).length === 1 ? "" : "n"} actuarse ahora).`}
        </p>
      )}

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
          No tiene documentos pendientes de firmar o revisar.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{s.documentoContrato?.nombre}</p>
                <p className="text-xs text-stone-400">
                  Expediente{" "}
                  {s.documentoContrato && (
                    <Link href={`/contratacion/expedientes/${s.documentoContrato.expedienteId}`} className="text-cdmb-700 hover:underline" title="Ir al expediente completo">
                      {s.documentoContrato.expediente.numero}
                    </Link>
                  )}{" "}
                  · Asignado por {s.asignadoPor.nombre}
                </p>
              </div>
              <span className="flex-none rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">{ETIQUETA_ROL[s.rol] ?? s.rol}
                {s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""}</span>
              {s.puedeActuar ? (
                <Link
                  href={`/contratacion/firmar/${s.id}`}
                  className="inline-flex flex-none items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
                >
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  {s.rol === "FIRMA" ? "Firmar" : "Dar visto bueno"}
                </Link>
              ) : (
                <span className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-400" title="Debe(n) resolver primero quien(es) tiene(n) un turno anterior">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Esperando turno
                </span>
              )}
              {s.documentoContrato && (
                <VistaPreviaDocumento
                  url={`/api/contratacion-documentos/${s.documentoContrato.id}${s.documentoContrato.mimeType === "application/pdf" && (s.documentoContrato.firmas.length > 0 || s.documentoContrato.solicitudesFirma.length > 0) ? "/rotulado" : ""}`}
                  nombre={s.documentoContrato.nombre}
                  mimeType={s.documentoContrato.mimeType}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
