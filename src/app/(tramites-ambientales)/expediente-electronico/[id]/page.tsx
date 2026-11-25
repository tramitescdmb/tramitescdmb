import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, ArrowLeft, CheckCircle2, Download, ExternalLink, FileText, History, Lock, ShieldCheck } from "lucide-react";
import { urlVitalPublico } from "@/lib/vital-links";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeVerExpedienteTramite } from "@/lib/permisos";
import { EstadoBadge } from "@/components/EstadoBadge";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { RegistrarReciente } from "@/components/RegistrarReciente";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";
import { nombreFlujo } from "@/lib/flujo-nombre";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";

function tamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Expediente electrónico (solo consulta) de un trámite ambiental finalizado y archivado: datos
 * del expediente e índice de todos sus documentos en orden (radicación y luego cada paso del
 * procedimiento), con visor y descarga. Los archivos se sirven desde el almacenamiento (NAS) por
 * /api/documentos, con los mismos permisos del expediente. No ofrece ninguna acción de edición.
 */
export default async function ExpedienteElectronicoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const e = await db.expediente.findUnique({
    where: { id },
    include: {
      tramiteTipo: { select: { nombre: true, codigo: true } },
      flujo: { select: { nombre: true, pasos: { orderBy: { numero: "asc" }, select: { numero: true, titulo: true } } } },
      documentos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          pasoNumero: true,
          nombre: true,
          descripcion: true,
          mimeType: true,
          tamanoBytes: true,
          hashSha256: true,
          createdAt: true,
          subidoPor: { select: { nombre: true } },
          firmas: { orderBy: { fechaHora: "asc" }, select: { fechaHora: true, cargoAlFirmar: true, usuario: { select: { nombre: true } } } },
          solicitudesFirma: { where: { rol: "VISTO_BUENO", estado: "COMPLETADA" }, select: { id: true } },
        },
      },
      eventos: { orderBy: { createdAt: "asc" }, select: { id: true, descripcion: true, createdAt: true, usuario: { select: { nombre: true } } } },
      archivadoPor: { select: { nombre: true } },
      subserie: { select: { codigo: true, nombre: true, serie: { select: { codigo: true, nombre: true } } } },
      solicitudesVital: { take: 1, select: { idVital: true, documentos: { orderBy: { createdAt: "asc" }, select: { id: true, nombre: true } } } },
    },
  });
  if (!e) notFound();
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeVerExpedienteTramite(permisos, e)) notFound();
  // Solo los archivados forman parte del expediente electrónico; uno en curso se gestiona en Expedientes.
  if (!e.archivado) redirect(`/expedientes/${e.id}`);

  const tituloPaso = new Map(e.flujo.pasos.map((p) => [p.numero, p.titulo]));
  const grupos: { clave: string; titulo: string; docs: typeof e.documentos }[] = [];
  const radicacion = e.documentos.filter((d) => d.pasoNumero === null);
  if (radicacion.length > 0) grupos.push({ clave: "radicacion", titulo: "Radicación de la solicitud", docs: radicacion });
  const numerosPaso = [...new Set(e.documentos.map((d) => d.pasoNumero).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  for (const n of numerosPaso) {
    const t = tituloPaso.get(n);
    grupos.push({ clave: `paso-${n}`, titulo: `Paso ${n}${t ? ` · ${t.charAt(0)}${t.slice(1).toLowerCase()}` : ""}`, docs: e.documentos.filter((d) => d.pasoNumero === n) });
  }
  let consecutivo = 0;
  const vital = e.solicitudesVital[0] ?? null;

  return (
    <div className="space-y-4">
      <RegistrarReciente href={`/expediente-electronico/${e.id}`} titulo={e.numero} detalle={`Expediente electrónico · ${e.tramiteTipo.nombre}`} modulo="Trámites 2.0" />

      <Link href="/expediente-electronico" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Expediente electrónico
      </Link>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <Archive className="h-5 w-5 text-stone-400" aria-hidden />
          <h1 className="font-mono text-xl font-semibold text-stone-800">{e.numero}</h1>
          <EstadoBadge estado={e.estado} />
          <span className="inline-flex items-center gap-1 rounded-sm bg-stone-800 px-2 py-0.5 text-xs font-medium text-white">
            <Lock className="h-3 w-3" aria-hidden />
            Archivado · solo consulta
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {e.tramiteTipo.codigo} — {e.tramiteTipo.nombre} · {nombreFlujo(e.flujo.nombre)}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Solicitante">
            {e.solicitanteNombre} ({e.solicitanteIdentificacion})
          </Dato>
          <Dato etiqueta="Municipio">{e.municipio}</Dato>
          {e.predioNombre && <Dato etiqueta="Predio">{e.predioNombre}</Dato>}
          <Dato etiqueta="Radicado">{formatearFecha(e.fechaRadicacion)}</Dato>
          <Dato etiqueta="Finalizado">{e.fechaCierre ? formatearFecha(e.fechaCierre) : "—"}</Dato>
          <Dato etiqueta="Archivado">
            {e.archivadoEn ? formatearFechaHora(e.archivadoEn) : "—"}
            {e.archivadoPor && <> · {e.archivadoPor.nombre}</>}
          </Dato>
          <Dato etiqueta="Clasificación TRD">
            {e.subserie ? `${e.subserie.serie.codigo} ${e.subserie.serie.nombre} / ${e.subserie.codigo} ${e.subserie.nombre}` : "Sin clasificar"}
          </Dato>
          <Dato etiqueta="Nivel de acceso">{ETIQUETA_NIVEL_ACCESO[e.nivelAcceso] ?? e.nivelAcceso}</Dato>
          <Dato etiqueta="Documentos">{e.documentos.length}</Dato>
        </dl>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white shadow-soft">
        <h2 className="flex items-center gap-2 border-b border-stone-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <FileText className="h-4 w-4" aria-hidden />
          Índice del expediente ({e.documentos.length} archivo{e.documentos.length === 1 ? "" : "s"})
        </h2>
        {grupos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-400">El expediente no tiene documentos cargados.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {grupos.map((g) => (
              <div key={g.clave} className="px-5 py-3">
                <h3 className="mb-2 text-sm font-semibold text-stone-800">{g.titulo}</h3>
                <ol className="space-y-2">
                  {g.docs.map((d) => {
                    consecutivo += 1;
                    const firmado = d.mimeType === "application/pdf" && (d.firmas.length > 0 || d.solicitudesFirma.length > 0);
                    const url = `/api/documentos/${d.id}${firmado ? "/rotulado" : ""}`;
                    return (
                      <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-stone-100 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <span className="w-7 flex-none pt-0.5 text-right font-mono text-xs tabular-nums text-stone-400">{consecutivo}</span>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium text-stone-800">{d.descripcion || d.nombre}</p>
                            {d.descripcion && <p className="break-all text-xs text-stone-500">{d.nombre}</p>}
                            <p className="text-xs text-stone-400">
                              {formatearFechaHora(d.createdAt)} · {d.subidoPor.nombre} · {tamano(d.tamanoBytes)}
                            </p>
                            {d.firmas.length > 0 && (
                              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-emerald-700">
                                <ShieldCheck className="h-3.5 w-3.5 flex-none" aria-hidden />
                                Firmado por{" "}
                                {d.firmas
                                  .map((f) => `${f.usuario.nombre}${f.cargoAlFirmar ? ` (${f.cargoAlFirmar})` : ""}, ${formatearFecha(f.fechaHora)}`)
                                  .join("; ")}
                              </p>
                            )}
                            {d.hashSha256 && (
                              <p className="font-mono text-[10px] text-stone-400" title={`SHA-256 ${d.hashSha256}`}>
                                SHA-256 {d.hashSha256.slice(0, 16)}…
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-none items-center gap-1.5 pl-10 sm:pl-0">
                          <VistaPreviaDocumento url={url} nombre={d.nombre} mimeType={d.mimeType} />
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Descargar
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      {vital && vital.documentos.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Anexos de la solicitud en VITAL {vital.idVital}</h2>
            <a href={urlVitalPublico(vital.idVital)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
              Ver anexos en VITAL <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
          <ul className="space-y-1">
            {vital.documentos.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5 text-sm">
                <FileText className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
                <a href={`/api/vital-documentos/${a.id}`} target="_blank" rel="noreferrer" className="truncate text-cdmb-700 hover:underline">
                  {a.nombre}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-2xl border border-stone-200 bg-white shadow-soft">
        <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <History className="h-4 w-4" aria-hidden />
          Historial de actuaciones ({e.eventos.length})
        </summary>
        <ol className="space-y-1.5 px-5 pb-4">
          {e.eventos.map((ev) => (
            <li key={ev.id} className="flex gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
              <span>
                <span className="text-stone-700">{ev.descripcion}</span>{" "}
                <span className="text-xs text-stone-400">
                  {ev.usuario.nombre} · {formatearFechaHora(ev.createdAt)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-stone-500">{etiqueta}</dt>
      <dd className="text-stone-800">{children}</dd>
    </div>
  );
}
