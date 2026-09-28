import Link from "next/link";
import { redirect } from "next/navigation";
import { FileX2 } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederFirmasTramite } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { contarPendientesBuzonTramite, listarHistorialRechazosFirma } from "@/lib/solicitudes-firma";
import { listarAvisosRechazoTramiteParaUsuario } from "@/lib/tramites-firma";
import { HistorialRechazosFirma } from "@/components/HistorialRechazosFirma";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { AvisoRechazoAcciones } from "@/components/AvisoRechazoAcciones";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { formatearFechaHora } from "@/lib/fecha";

export default async function RechazosFirmaTramitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederFirmasTramite(permisos)) {
    return <AccesoRestringido titulo="Firmas" quien="con acceso a algún trámite" volverHref="/tramites" volverLabel="Volver a Trámites" />;
  }

  const veTodos = session.rol === "ADMIN";
  const [pendientes, avisosRechazo, historialRechazos] = await Promise.all([
    contarPendientesBuzonTramite(session.userId),
    listarAvisosRechazoTramiteParaUsuario(session.userId, veTodos),
    listarHistorialRechazosFirma(session.userId, veTodos, "documentoExpediente"),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FileX2}>Rechazos al firmar</TituloSeccion>
      <FirmasSubNav pendientes={pendientes} rechazosPorAtender={avisosRechazo.length} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-900">Por atender</h3>
        {avisosRechazo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
            No tiene rechazos por atender.
          </p>
        ) : (
          <ul className="divide-y divide-red-100 rounded-xl border border-red-200 bg-red-50/40 shadow-sm">
            {avisosRechazo.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{a.documentoExpediente.nombre}</p>
                  <p className="text-xs text-stone-500">
                    Expediente{" "}
                    <Link href={`/expedientes/${a.documentoExpediente.expedienteId}`} className="text-cdmb-700 hover:underline" title="Ir al expediente completo">
                      {a.documentoExpediente.expediente.numero}
                    </Link>{" "}
                    · Subido por {a.subidoPor.nombre} · Rechazado por {a.rechazadoPor?.nombre ?? "—"} el {formatearFechaHora(a.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-stone-700">Motivo: {a.mensaje}</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Este aviso se borra solo al reemplazar el archivo con uno corregido, o puede descartarlo ahora si ya lo resolvió de otra forma.
                  </p>
                </div>
                <VistaPreviaDocumento
                  url={`/api/documentos/${a.documentoExpediente.id}${a.documentoExpediente.firmas.length > 0 ? "/rotulado" : ""}`}
                  nombre={a.documentoExpediente.nombre}
                  mimeType={a.documentoExpediente.mimeType}
                />
                <AvisoRechazoAcciones avisoId={a.id} endpoint="/api/avisos-rechazo" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <HistorialRechazosFirma rechazos={historialRechazos} hrefExpediente={(eid) => `/expedientes/${eid}`} abierto />
    </section>
  );
}
