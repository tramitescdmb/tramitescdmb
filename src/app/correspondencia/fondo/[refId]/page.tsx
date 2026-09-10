import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive, FileWarning } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import {
  fondoHistoricoConfigurado,
  FONDOS,
  AVISO_IMAGEN,
  urlIntranetPsdocuments,
  tieneVisorPsdocuments,
} from "@/lib/fondo-historico";
import { getFondoDocumento } from "@/lib/fondo-historico-data";
import { formatearFecha as fecha } from "@/lib/fecha";
import { ExternalLink } from "lucide-react";

const FONDO = FONDOS.psdocuments.id;

export default async function FichaFondoPage({ params }: { params: Promise<{ refId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");
  if (!fondoHistoricoConfigurado()) redirect("/correspondencia");

  const { refId } = await params;
  const doc = await getFondoDocumento(FONDO, decodeURIComponent(refId));
  if (!doc) notFound();

  const campos = (doc.campos && typeof doc.campos === "object" ? doc.campos : {}) as Record<string, unknown>;
  const camposVisibles = Object.entries(campos).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
  );

  const generales: [string, string | null][] = [
    ["Serie", doc.serieNombre],
    ["Dependencia / oficina", doc.oficina],
    ["Número", doc.numero],
    ["Número de entrada", doc.numeroEntrada],
    ["Número de salida", doc.numeroSalida],
    ["Fecha", doc.fecha ? fecha(doc.fecha) : null],
    ["Fecha de entrada", doc.fechaEntrada ? fecha(doc.fechaEntrada) : null],
    ["Fecha de salida", doc.fechaSalida ? fecha(doc.fechaSalida) : null],
    ["Tercero / razón social", doc.razonSocial],
    ["Destinatario", doc.destinatario],
    ["Firma", doc.firma],
    ["Estado", doc.estado],
    ["Ciclo", doc.ciclo],
  ];

  return (
    <div className="space-y-5">
      <Link href="/correspondencia/fondo" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al Fondo psdocuments
      </Link>

      <header className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Archive className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-stone-900">
            {doc.numero || doc.numeroEntrada || doc.numeroSalida || `Documento #${doc.refId}`}
          </h1>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Solo consulta</span>
        </div>
        {doc.asunto && <p className="mt-2 text-sm text-stone-700">{doc.asunto}</p>}
        <p className="mt-2 text-xs text-stone-400">
          Fondo psdocuments · id de documento {doc.refId}
          {doc.serieId != null ? ` · serie ${doc.serieId}` : ""}
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Datos del documento</h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {generales
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-stone-400">{k}</dt>
                <dd className="text-sm text-stone-800">{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      {camposVisibles.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Metadatos de la serie</h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {camposVisibles.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-stone-400">{k.replace(/_/g, " ").toLowerCase()}</dt>
                <dd className="text-sm text-stone-800 break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <FileWarning className="h-4 w-4" aria-hidden /> Documento escaneado
        </h2>
        {doc.tieneImagen ? (
          <>
            <p className="mt-2 text-sm text-amber-900">
              Este registro tiene {doc.numArchivos} archivo(s) escaneado(s) asociado(s). {AVISO_IMAGEN}
            </p>
            {(() => {
              const url = urlIntranetPsdocuments(doc.rutaOriginal);
              if (!url) return null;
              const conVisor = tieneVisorPsdocuments();
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {conVisor
                    ? "Abrir como PDF (solo desde la red CDMB)"
                    : "Descargar el escaneado (formato .tif, solo red CDMB)"}
                </a>
              );
            })()}
            {doc.rutaOriginal && (
              <p className="mt-2 break-all font-mono text-xs text-amber-700">Ruta en el sistema anterior: {doc.rutaOriginal}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-900">Este registro no tiene imagen escaneada asociada en el sistema anterior.</p>
        )}
      </section>
    </div>
  );
}
