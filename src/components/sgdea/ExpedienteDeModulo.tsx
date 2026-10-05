import Link from "next/link";
import { ArrowLeft, Building2, ChevronDown, Download, ExternalLink, FileText, History, Inbox, Lock, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import type { EstadoExpedienteDocumental, NivelAccesoInformacion, OrigenExpedienteDocumental } from "@prisma/client";
import { db } from "@/lib/db";
import { PestanasDetalle } from "@/components/sgdea/PestanasDetalle";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { ETIQUETA_ORIGEN_EXPEDIENTE, CLASE_ORIGEN_EXPEDIENTE, mensajeSoloEnModulo, enlaceOrigen } from "@/lib/archivo-central";
import { ETIQUETA_ACCION_BITACORA } from "@/lib/correspondencia-bitacora";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA } from "@/lib/contratacion-etiquetas";
import { formatearFechaHora } from "@/lib/fecha";

export type FichaExpedienteModulo = {
  id: string;
  numero: string;
  asunto: string;
  estado: EstadoExpedienteDocumental;
  origen: OrigenExpedienteDocumental;
  origenId: string | null;
  fechaApertura: Date;
  fechaCierre: Date | null;
  nivelAcceso: NivelAccesoInformacion;
  fundamentoNivelAcceso: string | null;
  dependencia: { nombre: string };
  serie: { codigo: string; nombre: string } | null;
  subserie: { codigo: string; nombre: string } | null;
  cerradoPor: { nombre: string } | null;
};

export type DocumentoDeModulo = {
  id: string;
  nombre: string;
  mimeType: string;
  createdAt: Date;
  hashSha256: string | null;
  subidoPor: string;
  firmado: boolean;
  url: string;
};

export type GrupoDocumentosDeModulo = { clave: string; titulo: string; radicacion?: boolean; documentos: DocumentoDeModulo[] };

type FirmasDocumento = { mimeType: string; firmas: { id: string }[]; solicitudesFirma: { rol: string; estado: string }[] };

function urlDocumento(base: string, d: FirmasDocumento): string {
  const conFirma = d.firmas.length > 0 || d.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA");
  return d.mimeType === "application/pdf" && conFirma ? `${base}/rotulado` : base;
}

export async function listarDocumentosDeModulo(
  origen: OrigenExpedienteDocumental,
  origenId: string | null
): Promise<GrupoDocumentosDeModulo[]> {
  if (!origenId) return [];
  const seleccion = {
    id: true,
    nombre: true,
    mimeType: true,
    createdAt: true,
    hashSha256: true,
    subidoPor: { select: { nombre: true } },
    firmas: { select: { id: true } },
    solicitudesFirma: { select: { rol: true, estado: true } },
  } as const;

  if (origen === "TRAMITES") {
    const [documentos, tramite] = await Promise.all([
      db.expedienteDocumento.findMany({
        where: { expedienteId: origenId },
        orderBy: { createdAt: "asc" },
        select: { ...seleccion, pasoNumero: true },
      }),
      db.expediente.findUnique({
        where: { id: origenId },
        select: { flujo: { select: { pasos: { orderBy: { numero: "asc" }, select: { numero: true, titulo: true } } } } },
      }),
    ]);
    const pasos = tramite?.flujo.pasos ?? [];
    const grupos = new Map<number | null, DocumentoDeModulo[]>();
    for (const d of documentos) {
      if (!grupos.has(d.pasoNumero)) grupos.set(d.pasoNumero, []);
      grupos.get(d.pasoNumero)!.push({
        id: d.id,
        nombre: d.nombre,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
        hashSha256: d.hashSha256,
        subidoPor: d.subidoPor.nombre,
        firmado: d.firmas.length > 0,
        url: urlDocumento(`/api/documentos/${d.id}`, d),
      });
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => (a ?? -1) - (b ?? -1))
      .map(([paso, docs]) => {
        const titulo = paso == null ? null : pasos.find((p) => p.numero === paso)?.titulo;
        return {
          clave: paso == null ? "radicacion" : `paso-${paso}`,
          titulo: paso == null ? "Documentos de radicación" : `Paso ${paso}${titulo ? ` · ${titulo}` : ""}`,
          radicacion: paso == null,
          documentos: docs,
        };
      });
  }

  if (origen === "GECON") {
    const documentos = await db.documentoContrato.findMany({
      where: { expedienteId: origenId },
      orderBy: { createdAt: "asc" },
      select: { ...seleccion, etapa: true },
    });
    return ETAPAS_ORDEN.map((etapa) => ({
      clave: etapa,
      titulo: ETIQUETA_ETAPA[etapa],
      documentos: documentos
        .filter((d) => d.etapa === etapa)
        .map((d) => ({
          id: d.id,
          nombre: d.nombre,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          hashSha256: d.hashSha256,
          subidoPor: d.subidoPor.nombre,
          firmado: d.firmas.length > 0,
          url: urlDocumento(`/api/contratacion-documentos/${d.id}`, d),
        })),
    })).filter((g) => g.documentos.length > 0);
  }

  return [];
}

function Dato({ etiqueta, children, ancho }: { etiqueta: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] text-stone-400">{etiqueta}</dt>
      <dd className="text-sm text-stone-800">{children}</dd>
    </div>
  );
}

export async function ExpedienteDeModulo({
  expediente,
  puedeAbrirModulo,
  ok,
  error,
}: {
  expediente: FichaExpedienteModulo;
  puedeAbrirModulo: boolean;
  ok?: string;
  error?: string;
}) {
  const [grupos, bitacora] = await Promise.all([
    listarDocumentosDeModulo(expediente.origen, expediente.origenId),
    db.auditoriaDoc.findMany({
      where: { entidad: "ExpedienteDocumental", entidadId: expediente.id },
      orderBy: { secuencia: "desc" },
      take: 30,
      include: { usuario: { select: { nombre: true } } },
    }),
  ]);
  const totalDocumentos = grupos.reduce((n, g) => n + g.documentos.length, 0);
  const cerrado = expediente.estado === "CERRADO";
  const etiquetaOrigen = ETIQUETA_ORIGEN_EXPEDIENTE[expediente.origen];
  const enlace = puedeAbrirModulo ? enlaceOrigen(expediente.origen, expediente.origenId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/correspondencia/expedientes" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a expedientes
        </Link>
        <Link
          href={`/correspondencia/expedientes/${expediente.id}/ficha`}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Ficha imprimible
        </Link>
      </div>

      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div
        className={`relative mt-3 rounded-xl rounded-tl-none border p-4 ${
          cerrado ? "border-stone-200 bg-stone-50" : "border-amber-200/80 bg-amber-50/40"
        }`}
      >
        <span
          className={`absolute -top-3 left-0 flex h-3 items-center rounded-t-md border border-b-0 px-3 ${
            cerrado ? "border-stone-200 bg-stone-100" : "border-amber-200/80 bg-amber-100"
          }`}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-black/10" />
        </span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className={`font-mono text-lg font-semibold ${cerrado ? "text-stone-600" : "text-cdmb-800"}`}>{expediente.numero}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              {expediente.dependencia.nombre}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cerrado ? "bg-stone-200/70 text-stone-600" : "bg-amber-100 text-amber-800"
            }`}
          >
            {cerrado ? <Lock className="h-3 w-3" aria-hidden /> : <RotateCcw className="h-3 w-3" aria-hidden />}
            {cerrado ? "Cerrado" : "Reabierto en el módulo"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${CLASE_ORIGEN_EXPEDIENTE[expediente.origen]}`}>
            {etiquetaOrigen}
          </span>
          <span className="text-xs text-stone-500">
            {totalDocumentos} documento{totalDocumentos === 1 ? "" : "s"}
          </span>
          {expediente.nivelAcceso !== "PUBLICA" && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[expediente.nivelAcceso]}`}>
              {ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso]}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-stone-700">{expediente.asunto}</p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Dato etiqueta="Serie (TRD)">{expediente.serie ? `${expediente.serie.codigo} — ${expediente.serie.nombre}` : "Sin clasificar"}</Dato>
          <Dato etiqueta="Subserie">{expediente.subserie ? `${expediente.subserie.codigo} — ${expediente.subserie.nombre}` : "—"}</Dato>
          <Dato etiqueta="Fecha de apertura">{formatearFechaHora(expediente.fechaApertura)}</Dato>
          <Dato etiqueta="Fecha de cierre">{expediente.fechaCierre ? formatearFechaHora(expediente.fechaCierre) : "—"}</Dato>
          <Dato etiqueta="Cerrado por">{expediente.cerradoPor?.nombre ?? "—"}</Dato>
          <Dato etiqueta="Nivel de acceso (Ley 1712/2014)">{ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso]}</Dato>
          {expediente.fundamentoNivelAcceso && (
            <Dato etiqueta="Fundamento" ancho>
              {expediente.fundamentoNivelAcceso}
            </Dato>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-white/70 px-3 py-2 text-sm text-stone-700">
          <span className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 flex-none text-stone-500" aria-hidden />
            {mensajeSoloEnModulo(expediente.origen)}
          </span>
          {enlace && (
            <Link
              href={enlace}
              className="inline-flex flex-none items-center gap-1.5 rounded-md border border-menu-500 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Abrir en {etiquetaOrigen}
            </Link>
          )}
        </div>
      </div>

      <PestanasDetalle
        grupos={[
          {
            id: "documentos",
            label: "Documentos",
            icono: <FileText className="h-4 w-4" aria-hidden />,
            contador: totalDocumentos,
            contenido: (
              <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Documentos en {etiquetaOrigen}</h3>
                {totalDocumentos === 0 ? (
                  <p className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-400">El expediente no tiene documentos.</p>
                ) : (
                  <div className="space-y-2">
                    {grupos.map((g, i) => (
                      <details key={g.clave} open={grupos.length <= 3 || i === 0} className="group rounded-lg border border-stone-200">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cdmb-700">
                            {g.radicacion && <Inbox className="h-3.5 w-3.5 flex-none" aria-hidden />}
                            {g.titulo}
                          </span>
                          <span className="flex flex-none items-center gap-2 text-xs text-stone-400">
                            {g.documentos.length} documento{g.documentos.length === 1 ? "" : "s"}
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                          </span>
                        </summary>
                        <ul className="divide-y divide-stone-100">
                          {g.documentos.map((doc) => (
                            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                              <span className="flex min-w-0 items-center gap-2">
                                <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5">
                                    <span className="block truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                                    {doc.firmado && (
                                      <span className="flex-none rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Firmado</span>
                                    )}
                                  </span>
                                  <span className="flex flex-wrap items-center gap-1 text-[10px] text-stone-400">
                                    {doc.subidoPor} · {formatearFechaHora(doc.createdAt)}
                                    {doc.hashSha256 && (
                                      <span className="flex items-center gap-1" title={doc.hashSha256}>
                                        · <ShieldCheck className="h-3 w-3" aria-hidden /> SHA-256 {doc.hashSha256.slice(0, 12)}…
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </span>
                              <span className="flex flex-none items-center gap-1.5">
                                <VistaPreviaDocumento url={doc.url} nombre={doc.nombre} mimeType={doc.mimeType} miniatura />
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
                                >
                                  <Download className="h-3.5 w-3.5" aria-hidden />
                                  Abrir
                                </a>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            id: "historial",
            label: "Historial",
            icono: <History className="h-4 w-4" aria-hidden />,
            contenido: (
              <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Bitácora de auditoría del SGDEA</h3>
                {bitacora.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin actuaciones registradas.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {bitacora.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                        <span className="text-stone-700">
                          <span className="font-medium">{ETIQUETA_ACCION_BITACORA[b.accion] ?? b.accion}</span>
                          {b.detalle ? ` — ${b.detalle}` : ""}
                        </span>
                        <span className="text-xs text-stone-400">{b.usuario?.nombre ?? "—"} · {formatearFechaHora(b.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
