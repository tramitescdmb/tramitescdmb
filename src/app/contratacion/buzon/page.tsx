import Link from "next/link";
import { ResumenBuzonFirmas } from "@/components/ResumenBuzonFirmas";
import { EsperaTurnoFirma, textoRecordatorio } from "@/components/EsperaTurnoFirma";
import { redirect } from "next/navigation";
import { Inbox, PenLine } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { listarBuzon, contarRechazosPorAtender } from "@/lib/solicitudes-firma";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { rotuloCalidadFirma, resumirPendientesFirma } from "@/lib/calidad-firma";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { RUTAS_FIRMAS_GECON } from "@/lib/rutas-firmas";

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
      <FirmasSubNav pendientes={resumirPendientesFirma(solicitudes)} rechazosPorAtender={rechazosPorAtender} rutas={RUTAS_FIRMAS_GECON} />

      <ResumenBuzonFirmas solicitudes={solicitudes} />

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
          No tiene documentos pendientes de firmar o revisar.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">
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
              <span className="flex-none rounded-sm bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">{ETIQUETA_ROL[s.rol] ?? s.rol}
                {s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""}</span>
              {textoRecordatorio(s.recordadoPor, s.recordadoEn) && (
                <span className="flex-none rounded-sm bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">{textoRecordatorio(s.recordadoPor, s.recordadoEn)}</span>
              )}
              {s.puedeActuar ? (
                <Link
                  href={`/contratacion/firmar/${s.id}`}
                  className="inline-flex flex-none items-center gap-1 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
                >
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  {s.rol === "FIRMA" ? "Firmar" : "Dar visto bueno"}
                </Link>
              ) : (
                <EsperaTurnoFirma esperaA={s.esperaA} solicitudId={s.id} />
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
