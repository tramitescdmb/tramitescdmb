import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";
import { EstadoBadge } from "@/components/EstadoBadge";

export default async function TramiteDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tramite = await db.tramiteTipo.findUnique({
    where: { slug },
    include: {
      documentosRequeridos: { orderBy: { orden: "asc" } },
      flujos: { orderBy: { orden: "asc" }, include: { pasos: { orderBy: { numero: "asc" } } } },
      expedientes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { tramiteTipo: false },
      },
    },
  });

  if (!tramite) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/tramites" className="text-sm text-cdmb-700 hover:underline">
          ← Catálogo de trámites
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
            {tramite.codigo} · versión {tramite.version}
          </span>
          <span className="text-xs text-gray-400">{tramite.proceso}</span>
        </div>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">{tramite.nombre}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Objeto <span className="font-normal normal-case text-gray-400">— para qué existe este trámite</span>
            </h2>
            <p className="text-sm text-gray-700">{tramite.objeto}</p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Alcance <span className="font-normal normal-case text-gray-400">— a quién aplica</span>
            </h2>
            <p className="text-sm text-gray-700">{tramite.alcance}</p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Autoridad y responsabilidad <span className="font-normal normal-case text-gray-400">— quién lo administra</span>
            </h2>
            <p className="text-sm text-gray-700">{tramite.autoridadResponsabilidad}</p>
          </section>

          {tramite.documentosRequeridos.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Documentos para radicar
              </h2>
              <p className="mb-2 text-xs text-gray-500">
                Esta es la lista de documentos que el solicitante debe aportar. Al crear un expediente nuevo,
                la app te pedirá subir cada uno de estos (los marcados con <strong>*</strong> son obligatorios,
                los demás solo aplican en algunos casos — lee la nota de cada uno).
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {tramite.documentosRequeridos.map((d) => (
                  <li key={d.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-gray-400">{d.orden}.</span>
                      <div>
                        <p className="text-gray-800">
                          {d.nombre} {d.obligatorio && <span className="text-red-500">*</span>}
                        </p>
                        {d.notas && <p className="text-xs text-gray-500">{d.notas}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Pasos del trámite
              </h2>
              <p className="text-xs text-gray-500">
                Así avanza el expediente de principio a fin. Para cada paso se indica quién es responsable,
                qué documentos se generan o revisan, y el tiempo estimado.
              </p>
            </div>

            {tramite.flujos.map((flujo) => (
              <div key={flujo.id}>
                {tramite.flujos.length > 1 && (
                  <h3 className="mb-2 inline-block rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    Flujo: {flujo.nombre}
                    {flujo.esFlujoInicial && " (con este se crea el expediente)"}
                  </h3>
                )}
                <ol className="space-y-3">
                  {flujo.pasos.map((paso) => (
                    <li key={paso.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">
                          {paso.numero}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{paso.titulo}</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{paso.descripcion}</p>

                          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                            {paso.responsables.length > 0 && (
                              <div>
                                <dt className="font-medium text-gray-500">Responsable</dt>
                                <dd className="text-gray-700">{paso.responsables.join(", ")}</dd>
                              </div>
                            )}
                            {paso.documentos.length > 0 && (
                              <div>
                                <dt className="font-medium text-gray-500">Documentos / registros</dt>
                                <dd className="text-gray-700">{paso.documentos.join(", ")}</dd>
                              </div>
                            )}
                            {paso.tiempo && (
                              <div>
                                <dt className="font-medium text-gray-500">Tiempo estimado</dt>
                                <dd className="text-gray-700">{paso.tiempo}</dd>
                              </div>
                            )}
                          </dl>

                          {paso.esDecision && (
                            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                              ⚠ Este paso es una decisión: quien lo gestione deberá elegir cómo continúa el
                              expediente (por ejemplo, aprobar, negar o pedir más información).
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-cdmb-200 bg-cdmb-50 p-4">
            <p className="mb-2 text-sm text-cdmb-900">
              ¿Va a radicar una solicitud nueva de este trámite? Crea el expediente aquí — te va a pedir los
              datos del solicitante y los documentos de la lista de arriba.
            </p>
            <Link
              href={`/tramites/${tramite.slug}/nuevo`}
              className="inline-flex w-full items-center justify-center rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
            >
              + Iniciar nuevo expediente
            </Link>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Expedientes recientes</h3>
              <p className="text-xs text-gray-500">Últimos casos radicados de este trámite.</p>
            </div>
            {tramite.expedientes.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Aún no hay expedientes.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tramite.expedientes.map((exp) => (
                  <li key={exp.id} className="px-4 py-2.5">
                    <Link href={`/expedientes/${exp.id}`} className="text-sm font-medium text-gray-800 hover:text-cdmb-700">
                      {exp.numero}
                    </Link>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{exp.solicitanteNombre}</span>
                      <EstadoBadge estado={exp.estado} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
