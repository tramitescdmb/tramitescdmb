import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EstadoBadge } from "@/components/EstadoBadge";
import { getTramitePorSlug, tiempoEstimadoDias } from "@/lib/tramites-data";
import { categoriaTramite } from "@/lib/tramite-categoria";

export default async function TramiteDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [tramite, expedientes] = await Promise.all([
    getTramitePorSlug(slug),
    db.expediente.findMany({
      where: { tramiteTipo: { slug } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, numero: true, solicitanteNombre: true, estado: true },
    }),
  ]);

  if (!tramite) notFound();

  const flujoPrincipal = tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0];
  const tiempo = flujoPrincipal ? tiempoEstimadoDias(flujoPrincipal.pasos) : null;
  const categoria = categoriaTramite(tramite.nombre);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tramites" className="text-sm text-cdmb-700 hover:underline">
          ← Catálogo de trámites
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
            {tramite.codigo} · versión {tramite.version}
          </span>
          <span className="text-xs text-stone-400">{tramite.proceso}</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-cdmb-50 text-xl"
            title={categoria.etiqueta}
            aria-hidden
          >
            {categoria.emoji}
          </span>
          <h1 className="text-xl font-semibold text-stone-900">{tramite.nombre}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Objeto / alcance / autoridad en una sola tarjeta compacta, con líneas de resumen */}
          <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <p>
              <span className="font-medium text-stone-700">Qué es: </span>
              <span className="text-stone-600">{tramite.objeto}</span>
            </p>
            <p>
              <span className="font-medium text-stone-700">A quién aplica: </span>
              <span className="text-stone-600">{tramite.alcance}</span>
            </p>
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
                Ver autoridad y responsabilidad
              </summary>
              <p className="mt-2 text-stone-600">{tramite.autoridadResponsabilidad}</p>
            </details>
          </section>

          {tramite.documentosRequeridos.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-stone-900">
                Documentos para radicar
                <span className="ml-2 font-normal text-stone-400">
                  ({tramite.documentosRequeridos.filter((d) => d.obligatorio).length} obligatorios de{" "}
                  {tramite.documentosRequeridos.length})
                </span>
              </h2>
              <ol className="mt-2 space-y-1 text-sm">
                {tramite.documentosRequeridos.map((d) => (
                  <li key={d.id} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-none text-stone-300">{d.orden}.</span>
                    <span className="text-stone-700">
                      {d.nombre}
                      {d.obligatorio && <span className="text-red-500"> *</span>}
                      {d.notas && <span className="block text-xs text-stone-400">{d.notas}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-stone-900">Pasos del trámite</h2>
              <p className="text-xs text-stone-400">Clic en cada paso para ver el detalle</p>
            </div>

            {tramite.flujos.map((flujo) => (
              <div key={flujo.id} className="mb-4">
                {tramite.flujos.length > 1 && (
                  <h3 className="mb-2 inline-block rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                    {flujo.nombre}
                    {flujo.esFlujoInicial && " (inicia el expediente)"}
                  </h3>
                )}
                <div className="space-y-1.5">
                  {flujo.pasos.map((paso) => (
                    <details key={paso.id} className="group rounded-lg border border-stone-200 bg-white open:shadow-sm">
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">
                          {paso.numero}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{paso.titulo}</span>
                        {paso.esDecision && <span className="flex-none text-xs text-amber-600">⚠ decisión</span>}
                        {paso.tiempo && <span className="flex-none text-xs text-stone-400">{paso.tiempo}</span>}
                        <svg
                          className="h-4 w-4 flex-none text-stone-300 transition-transform group-open:rotate-180"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="border-t border-stone-100 px-3 pb-3 pt-2 pl-12 text-sm">
                        <p className="whitespace-pre-line text-stone-600">{paso.descripcion}</p>
                        <dl className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                          {paso.responsables.length > 0 && (
                            <div>
                              <dt className="font-medium text-stone-500">👤 Responsable</dt>
                              <dd className="text-stone-600">{paso.responsables.join(", ")}</dd>
                            </div>
                          )}
                          {paso.documentos.length > 0 && (
                            <div>
                              <dt className="font-medium text-stone-500">📄 Documentos/registros</dt>
                              <dd className="text-stone-600">{paso.documentos.join(", ")}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-cdmb-200 bg-cdmb-50 p-4">
            {tiempo && tiempo.total > 0 && (
              <p className="mb-3 border-b border-cdmb-200 pb-3 text-sm text-cdmb-900">
                🕒 <strong>~{tiempo.total} días hábiles</strong> estimados
                {!tiempo.completo && (
                  <span className="block text-xs text-cdmb-700">
                    (suma de {tiempo.pasosConTiempo} de {tiempo.pasosTotal} pasos que tienen tiempo definido en el
                    procedimiento — puede tomar más)
                  </span>
                )}
              </p>
            )}
            <p className="mb-2 text-sm text-cdmb-900">
              ¿Vas a radicar una solicitud nueva? Crea el expediente aquí.
            </p>
            <Link
              href={`/tramites/${tramite.slug}/nuevo`}
              className="inline-flex w-full items-center justify-center rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
            >
              + Iniciar nuevo expediente
            </Link>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white">
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-stone-900">Expedientes recientes</h3>
            </div>
            {expedientes.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">Aún no hay expedientes.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {expedientes.map((exp) => (
                  <li key={exp.id} className="px-4 py-2.5">
                    <Link href={`/expedientes/${exp.id}`} className="text-sm font-medium text-stone-800 hover:text-cdmb-700">
                      {exp.numero}
                    </Link>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-stone-500">{exp.solicitanteNombre}</span>
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
