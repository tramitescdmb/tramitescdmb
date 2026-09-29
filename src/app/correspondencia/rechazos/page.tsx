import Link from "next/link";
import { redirect } from "next/navigation";
import { FileX2, ChevronDown } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { contarPendientesBuzonSgdea, listarAvisosRechazoSgdea, listarHistorialRechazosSgdea } from "@/lib/firmas-sgdea";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { AvisoRechazoAcciones } from "@/components/AvisoRechazoAcciones";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { formatearFechaHora } from "@/lib/fecha";
import { RUTAS_FIRMAS_SGDEA } from "@/lib/rutas-firmas";

export default async function RechazosCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const veTodos = puedeAdministrarArchivo(permisos);
  const [pendientes, avisosRechazo, historialRechazos] = await Promise.all([
    contarPendientesBuzonSgdea(session.userId),
    listarAvisosRechazoSgdea(session.userId, veTodos),
    listarHistorialRechazosSgdea(session.userId, veTodos),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FileX2}>Rechazos al firmar</TituloSeccion>
      <FirmasSubNav pendientes={pendientes} rechazosPorAtender={avisosRechazo.length} rutas={RUTAS_FIRMAS_SGDEA} />

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
                  <p className="truncate text-sm font-medium text-stone-800">{a.comunicacion?.asunto ?? a.documentoArchivo?.nombre}</p>
                  <p className="text-xs text-stone-500">
                    {a.comunicacion ? (
                      <>Radicado {a.comunicacion.radicado}</>
                    ) : (
                      <>
                        Expediente{" "}
                        <Link href={`/correspondencia/expedientes/${a.documentoArchivo!.expedienteDocumentalId}`} className="text-cdmb-700 hover:underline" title="Ir al expediente completo">
                          {a.documentoArchivo!.expediente.numero}
                        </Link>
                      </>
                    )}{" "}
                    · Subido por {a.subidoPor.nombre} · Rechazado por {a.rechazadoPor?.nombre ?? "—"} el {formatearFechaHora(a.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-stone-700">Motivo: {a.mensaje}</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Este aviso se borra solo al reemplazar el archivo con uno corregido, o puede descartarlo ahora si ya lo resolvió de otra forma.
                  </p>
                </div>
                {a.comunicacion ? (
                  <Link
                    href={`/correspondencia/${a.comunicacion.id}`}
                    className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Ver comunicación
                  </Link>
                ) : (
                  <VistaPreviaDocumento
                    url={`/api/documentos-archivo/${a.documentoArchivo!.id}${a.documentoArchivo!.mimeType === "application/pdf" ? "/rotulado" : ""}`}
                    nombre={a.documentoArchivo!.nombre}
                    mimeType={a.documentoArchivo!.mimeType}
                  />
                )}
                <AvisoRechazoAcciones avisoId={a.id} endpoint="/api/correspondencia/avisos-rechazo" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {historialRechazos.length > 0 && (
        <details open className="group rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            <span className="text-xs font-medium text-stone-700">Historial de rechazos</span>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              {historialRechazos.length} rechazo{historialRechazos.length === 1 ? "" : "s"}
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <p className="mt-2 text-xs text-stone-500">
            Registro permanente de los rechazos, aunque el aviso ya se haya descartado o el archivo se haya corregido.
          </p>
          <ul className="mt-2 divide-y divide-stone-100 text-xs">
            {historialRechazos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 text-stone-700">
                  <span className="font-medium">{r.titulo}</span>
                  {r.motivo && <span className="text-stone-500"> — {r.motivo}</span>}
                </span>
                <Link href={r.enlace} className="flex-none text-cdmb-700 hover:underline">
                  {r.referencia}
                </Link>
                <span className="flex-none text-stone-400">Rechazó: {r.rechazadoPor}</span>
                <span className="flex-none text-stone-400">{formatearFechaHora(r.fecha)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
