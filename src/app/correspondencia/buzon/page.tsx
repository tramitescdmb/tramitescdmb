import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, PenLine, Lock, Clock, Mail, FileText } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { rotuloCalidadFirma, resumirPendientesFirma } from "@/lib/calidad-firma";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { RUTAS_FIRMAS_SGDEA } from "@/lib/rutas-firmas";
import { listarBuzonSgdea, contarRechazosPorAtenderSgdea } from "@/lib/firmas-sgdea";

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Debe dar visto bueno" };

export default async function BuzonCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const veTodos = puedeAdministrarArchivo(permisos);

  const [solicitudes, rechazosPorAtender] = await Promise.all([
    listarBuzonSgdea(session.userId),
    contarRechazosPorAtenderSgdea(session.userId, veTodos),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Inbox}>Buzón de firmas</TituloSeccion>
      <FirmasSubNav pendientes={resumirPendientesFirma(solicitudes)} rechazosPorAtender={rechazosPorAtender} rutas={RUTAS_FIRMAS_SGDEA} />

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
          No tiene comunicaciones ni documentos pendientes de firmar o revisar.
        </p>
      ) : (
        [
          { titulo: "Le toca a usted", Icono: PenLine, lista: solicitudes.filter((s) => s.puedeActuar), vacio: "Nada en su turno por ahora." },
          { titulo: "En espera de turno", Icono: Clock, lista: solicitudes.filter((s) => !s.puedeActuar), vacio: null },
        ].filter((g) => g.lista.length > 0 || g.vacio).map((grupo) => (
        <section key={grupo.titulo} className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
            <grupo.Icono className="h-4 w-4 text-cdmb-600" aria-hidden />
            {grupo.titulo}
            <span className="rounded-full bg-stone-100 px-2 text-xs font-medium text-stone-500">{grupo.lista.length}</span>
          </h2>
          {grupo.lista.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">{grupo.vacio}</p>
          ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-soft">
          {grupo.lista.map((s) => {
            const pdfComunicacion = s.comunicacion?.documentos.find((d) => d.mimeType === "application/pdf") ?? null;
            const IconoTipo = s.comunicacion ? Mail : FileText;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-cdmb-50 text-cdmb-700">
                  <IconoTipo className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{s.comunicacion?.asunto ?? s.documentoArchivo?.nombre}</p>
                  <p className="text-xs text-stone-400">
                    {s.comunicacion
                      ? s.comunicacion.radicado
                      : (
                        <>
                          Expediente{" "}
                          <Link href={`/correspondencia/expedientes/${s.documentoArchivo!.expedienteDocumentalId}`} className="text-cdmb-700 hover:underline" title="Ir al expediente completo">
                            {s.documentoArchivo!.expediente.numero}
                          </Link>
                        </>
                      )}{" "}
                    · Asignado por {s.asignadoPor.nombre} el {formatearFechaHora(s.asignadoEn)}
                  </p>
                </div>
                <span className="flex-none rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">
                  {ETIQUETA_ROL[s.rol] ?? s.rol}
                  {s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""}
                </span>
                {s.puedeActuar ? (
                  <Link
                    href={s.comunicacion ? `/correspondencia/${s.comunicacion.id}` : `/correspondencia/expedientes/${s.documentoArchivo!.expedienteDocumentalId}`}
                    className="inline-flex flex-none items-center gap-1 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
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
                {s.documentoArchivo && s.documentoArchivo.mimeType === "application/pdf" && (
                  <VistaPreviaDocumento url={`/api/documentos-archivo/${s.documentoArchivo.id}/rotulado`} nombre={s.documentoArchivo.nombre} mimeType={s.documentoArchivo.mimeType} />
                )}
                {pdfComunicacion && (
                  <VistaPreviaDocumento url={`/api/correspondencia-documentos/${pdfComunicacion.id}/rotulado`} nombre={s.comunicacion!.asunto} mimeType={pdfComunicacion.mimeType} />
                )}
              </li>
            );
          })}
        </ul>
          )}
        </section>
        ))
      )}
    </section>
  );
}
