import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EstadoBadge } from "@/components/EstadoBadge";
import { getTramitePorSlug, tiempoEstimadoDias } from "@/lib/tramites-data";
import { categoriaTramite } from "@/lib/tramite-categoria";
import { cargoCanonico, cargosEnTexto, cargosQueIntervienen } from "@/lib/cargos";

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
  const cargos = cargosQueIntervienen(tramite.flujos);
  const cargosResponsables = cargosEnTexto(tramite.autoridadResponsabilidad);

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
          {tramite.suitNumeros.map((numero) => (
            <a
              key={numero}
              href={`https://visorsuit.funcionpublica.gov.co/auth/visor?fi=${numero}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 hover:bg-stone-200"
              title="Ver la ficha oficial de este trámite en el SUIT (Sistema Único de Información de Trámites del Gobierno de Colombia)"
            >
              🏛️ SUIT {numero} ↗
            </a>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <span
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg text-xl ${categoria.clases.icono}`}
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
          <section className="relative overflow-hidden rounded-xl border border-stone-200 bg-white p-4 pl-5 text-sm">
            <span className={`absolute inset-y-0 left-0 w-1.5 ${categoria.clases.barra}`} aria-hidden />
            <div className="space-y-3">
              <p className="text-base text-stone-800">{tramite.resumen ?? tramite.objeto}</p>
              <p>
                <span className="font-medium text-stone-700">A quién aplica: </span>
                <span className="text-stone-600">{tramite.alcance}</span>
              </p>
              {cargosResponsables.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-stone-50 p-2.5">
                  <span className="text-sm font-medium text-stone-700">👤 Responsable:</span>
                  {cargosResponsables.map((c) => (
                    <span
                      key={c}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${categoria.clases.badge}`}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
                  Ver objetivo formal, autoridad y responsabilidad (texto original del procedimiento)
                </summary>
                <div className="mt-2 space-y-2 text-stone-600">
                  <p>{tramite.objeto}</p>
                  <p>{tramite.autoridadResponsabilidad}</p>
                </div>
              </details>
            </div>
          </section>

          {cargos.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-stone-900">Quiénes intervienen</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Cargos de la CDMB que participan en algún paso de este trámite, según el procedimiento oficial.
                Es informativo: cualquier funcionario puede seguir gestionando cualquier paso.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cargos.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${categoria.clases.badge}`}
                  >
                    👤 {c}
                  </span>
                ))}
              </div>
            </section>
          )}

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

          {tramite.flujos.length > 0 && (
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
                  {flujo.pasos.map((paso) => {
                    const responsablesCanonicos = Array.from(new Set(paso.responsables.map(cargoCanonico)));
                    return (
                      <details key={paso.id} className="group rounded-lg border border-stone-200 bg-white open:shadow-sm">
                        <summary className="flex cursor-pointer list-none items-start gap-3 p-3 [&::-webkit-details-marker]:hidden">
                          <span
                            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${categoria.clases.icono}`}
                          >
                            {paso.numero}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-medium text-stone-800">{paso.titulo}</span>
                              {paso.esDecision && <span className="flex-none text-xs text-amber-600">⚠ decisión</span>}
                              {paso.tiempo && <span className="flex-none text-xs text-stone-400">{paso.tiempo}</span>}
                            </div>
                            {responsablesCanonicos.length > 0 && (
                              <p className="mt-1 text-xs text-stone-500">
                                <span aria-hidden>👤</span> {responsablesCanonicos.join(" · ")}
                              </p>
                            )}
                          </div>
                          <svg
                            className="mt-1 h-4 w-4 flex-none text-stone-300 transition-transform group-open:rotate-180"
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
                                <dt className="font-medium text-stone-500">👤 Responsable (texto original del PDF)</dt>
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
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-cdmb-200 bg-cdmb-50 p-4">
            {tiempo && (
              <p className="mb-3 border-b border-cdmb-200 pb-3 text-sm text-cdmb-900">
                {tiempo.total > 0 ? (
                  <>
                    🕒 <strong>~{tiempo.total} días hábiles</strong> estimados
                    {!tiempo.completo && (
                      <span className="block text-xs text-cdmb-700">
                        (suma de {tiempo.pasosConTiempo} de {tiempo.pasosTotal} pasos que tienen tiempo definido en
                        el procedimiento — puede tomar más)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    🕒 Tiempo sin especificar
                    <span className="block text-xs text-cdmb-700">
                      El procedimiento oficial no indica un tiempo por actividad para este trámite.
                    </span>
                  </>
                )}
              </p>
            )}
            {tramite.flujos.length > 0 ? (
              <>
                <p className="mb-2 text-sm text-cdmb-900">
                  ¿Vas a radicar una solicitud nueva? Crea el expediente aquí.
                </p>
                <Link
                  href={`/tramites/${tramite.slug}/nuevo`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                >
                  + Iniciar nuevo expediente
                </Link>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm text-cdmb-900">
                  Este trámite todavía no se sigue paso a paso en SINCA. Gestiónalo directamente en VITAL
                  {tramite.suitNumeros.length > 0 && " o consulta su ficha oficial en el SUIT"}.
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://vital-publico.minambiente.gov.co/inicio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                  >
                    Ir a VITAL ↗
                  </a>
                  {tramite.suitNumeros.map((numero) => (
                    <a
                      key={numero}
                      href={`https://visorsuit.funcionpublica.gov.co/auth/visor?fi=${numero}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-md border border-cdmb-300 bg-white px-4 py-2 text-sm font-medium text-cdmb-800 hover:bg-cdmb-50"
                    >
                      Ver ficha SUIT {numero} ↗
                    </a>
                  ))}
                </div>
              </>
            )}
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
