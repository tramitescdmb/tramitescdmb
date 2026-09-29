import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Eye, FileText } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { RUTAS_FIRMAS_SGDEA } from "@/lib/rutas-firmas";
import { rotuloCalidadFirma } from "@/lib/calidad-firma";
import { listarMisFirmasSgdea, contarPendientesBuzonSgdea, contarRechazosPorAtenderSgdea } from "@/lib/firmas-sgdea";

export default async function MisFirmasCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const [pendientes, rechazosPorAtender, firmas] = await Promise.all([
    contarPendientesBuzonSgdea(session.userId),
    contarRechazosPorAtenderSgdea(session.userId, puedeAdministrarArchivo(permisos)),
    listarMisFirmasSgdea(session.userId),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FileSignature}>Mis firmas</TituloSeccion>
      <FirmasSubNav pendientes={pendientes} rechazosPorAtender={rechazosPorAtender} rutas={RUTAS_FIRMAS_SGDEA} />

      {firmas.length === 0 ? (
        <EstadoVacio icon={FileSignature}>Todavía no ha firmado ninguna comunicación ni documento en el SGDEA.</EstadoVacio>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {firmas.map((f) => {
            const pdfComunicacion = f.comunicacion?.documentos.find((d) => d.mimeType === "application/pdf") ?? null;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-stone-800">
                    {f.comunicacion?.asunto ?? f.documentoArchivo?.nombre}
                    {rotuloCalidadFirma(f.calidad) && (
                      <span className="flex-none rounded-full bg-cdmb-50 px-1.5 py-0.5 text-[10px] font-medium text-cdmb-700">{rotuloCalidadFirma(f.calidad)}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-stone-400">
                    {f.comunicacion ? f.comunicacion.radicado : `Expediente ${f.documentoArchivo!.expediente.numero}`}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                    {formatearFechaHoraLarga(f.fechaHora)} · SHA-256 {f.hashContenido.slice(0, 16)}…
                  </p>
                </div>
                {f.comunicacion ? (
                  <>
                    {pdfComunicacion && (
                      <a
                        href={`/api/correspondencia-documentos/${pdfComunicacion.id}/rotulado`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abre el PDF con su rótulo de radicación y sello de firma"
                        className="inline-flex flex-none items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Ver documento
                      </a>
                    )}
                    <Link
                      href={`/correspondencia/${f.comunicacion.id}`}
                      className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ver comunicación
                    </Link>
                    <Link
                      href={`/correspondencia/${f.comunicacion.id}/ficha-firma`}
                      className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ficha técnica
                    </Link>
                  </>
                ) : (
                  <>
                    <a
                      href={`/api/documentos-archivo/${f.documentoArchivo!.id}${f.documentoArchivo!.mimeType === "application/pdf" ? "/rotulado" : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      title={f.documentoArchivo!.mimeType === "application/pdf" ? "Abre el PDF con su sello de firma electrónica" : "Abre el archivo firmado"}
                      className="inline-flex flex-none items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Ver documento
                    </a>
                    <Link
                      href={`/correspondencia/expedientes/${f.documentoArchivo!.expedienteDocumentalId}`}
                      className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ver expediente
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
