import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EstadoBadge } from "@/components/EstadoBadge";
import { EventoIcono } from "@/components/EventoIcono";
import { Field, SectionHelp } from "@/components/Field";
import { SubirDocumentoPasoForm } from "@/components/SubirDocumentoPasoForm";
import { cargoCoincideConPaso } from "@/lib/cargos";

const ESTADOS = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
] as const;

type Opcion = { respuesta: string; siguientePaso: number | null; resultado?: string };

export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: {
      tramiteTipo: true,
      flujo: { include: { pasos: { orderBy: { numero: "asc" } } } },
      documentos: { orderBy: { createdAt: "desc" }, include: { subidoPor: true } },
      eventos: { orderBy: { createdAt: "desc" }, include: { usuario: true } },
      creadoPor: true,
      responsableActual: true,
    },
  });

  if (!expediente) notFound();

  const session = await getSession();
  const pasos = expediente.flujo.pasos;
  const currentIndex = pasos.findIndex((p) => p.numero === expediente.pasoActualNumero);
  const pasoActual = currentIndex >= 0 ? pasos[currentIndex] : null;
  const siguientePaso = currentIndex >= 0 ? pasos[currentIndex + 1] : null;
  const esTerminal = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"].includes(expediente.estado);
  const esMiPaso = pasoActual ? cargoCoincideConPaso(session?.cargo, pasoActual.responsables) : false;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expedientes" className="text-sm text-cdmb-700 hover:underline">
          ← Expedientes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">{expediente.numero}</h1>
          <EstadoBadge estado={expediente.estado} />
        </div>
        <p className="text-sm text-stone-500">
          <Link href={`/tramites/${expediente.tramiteTipo.slug}`} className="hover:text-cdmb-700">
            {expediente.tramiteTipo.nombre}
          </Link>{" "}
          · Flujo: {expediente.flujo.nombre}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Datos del solicitante */}
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-stone-900">Solicitante</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-stone-400">Nombre / razón social</dt>
                <dd className="text-stone-800">{expediente.solicitanteNombre}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Identificación</dt>
                <dd className="text-stone-800">{expediente.solicitanteIdentificacion}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Correo</dt>
                <dd className="text-stone-800">{expediente.solicitanteEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Teléfono</dt>
                <dd className="text-stone-800">{expediente.solicitanteTelefono ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Municipio</dt>
                <dd className="text-stone-800">{expediente.municipio}</dd>
              </div>
            </dl>

            {expediente.ubicacionLat != null && expediente.ubicacionLon != null && (
              <div className="mt-3 border-t border-stone-100 pt-3 text-sm">
                <dt className="mb-1 text-xs text-stone-400">📍 Ubicación tomada en campo</dt>
                <dd className="space-y-0.5 text-stone-700">
                  <p>
                    Elipsoidales (lat/lon, WGS84): {expediente.ubicacionLat.toFixed(6)}, {expediente.ubicacionLon.toFixed(6)}
                  </p>
                  {expediente.ubicacionPlanaX != null && expediente.ubicacionPlanaY != null && (
                    <p>
                      Planas (MAGNA-SIRGAS Origen-Nacional): X {expediente.ubicacionPlanaX.toLocaleString("es-CO")} m,
                      Y {expediente.ubicacionPlanaY.toLocaleString("es-CO")} m
                    </p>
                  )}
                  {expediente.ubicacionCartesianaX != null && expediente.ubicacionCartesianaY != null && expediente.ubicacionCartesianaZ != null && (
                    <p>
                      Cartesianas (ECEF): X {expediente.ubicacionCartesianaX.toLocaleString("es-CO")} m, Y{" "}
                      {expediente.ubicacionCartesianaY.toLocaleString("es-CO")} m, Z{" "}
                      {expediente.ubicacionCartesianaZ.toLocaleString("es-CO")} m
                    </p>
                  )}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${expediente.ubicacionLat}&mlon=${expediente.ubicacionLon}#map=17/${expediente.ubicacionLat}/${expediente.ubicacionLon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-cdmb-700 hover:underline"
                  >
                    Ver en el mapa ↗
                  </a>
                </dd>
              </div>
            )}
          </section>

          {/* Paso actual */}
          {pasoActual ? (
            <section className="rounded-xl border border-cdmb-300 bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-cdmb-600">
                  Paso actual ({pasoActual.numero} de {pasos.length})
                </p>
                {esMiPaso && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    ✋ Te corresponde a ti ({session?.cargo})
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-stone-900">{pasoActual.titulo}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{pasoActual.descripcion}</p>

              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                {pasoActual.responsables.length > 0 && (
                  <div>
                    <dt className="font-medium text-stone-500">👤 Responsable</dt>
                    <dd className="text-stone-700">{pasoActual.responsables.join(", ")}</dd>
                  </div>
                )}
                {pasoActual.documentos.length > 0 && (
                  <div>
                    <dt className="font-medium text-stone-500">📄 Documentos/registros de este paso</dt>
                    <dd className="text-stone-700">{pasoActual.documentos.join(", ")}</dd>
                  </div>
                )}
                {pasoActual.tiempo && (
                  <div>
                    <dt className="font-medium text-stone-500">🕒 Tiempo estimado</dt>
                    <dd className="text-stone-700">{pasoActual.tiempo}</dd>
                  </div>
                )}
              </dl>

              {/* Subir documento de este paso */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                <SubirDocumentoPasoForm expedienteId={expediente.id} pasoNumero={pasoActual.numero} />
              </div>

              {/* Acciones para avanzar */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                {pasoActual.esDecision ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-stone-500">
                      ⚠ Este paso requiere una decisión. Elige qué pasó realmente para que el expediente
                      siga el camino correcto:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(pasoActual.opciones) &&
                        (pasoActual.opciones as unknown as Opcion[]).map((op, idx) => (
                          <form key={idx} action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                            {op.siguientePaso != null && (
                              <input type="hidden" name="siguientePasoNumero" value={op.siguientePaso} />
                            )}
                            {op.resultado && <input type="hidden" name="resultado" value={op.resultado} />}
                            <button
                              type="submit"
                              className="rounded-md border border-cdmb-300 bg-cdmb-50 px-3 py-1.5 text-sm font-medium text-cdmb-800 hover:bg-cdmb-100"
                            >
                              {op.respuesta}
                            </button>
                          </form>
                        ))}
                      {!Array.isArray(pasoActual.opciones) && siguientePaso && (
                        <form action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                          <input type="hidden" name="siguientePasoNumero" value={siguientePaso.numero} />
                          <button
                            type="submit"
                            className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                          >
                            Continuar al paso {siguientePaso.numero}
                          </button>
                        </form>
                      )}
                    </div>
                    <p className="text-xs text-stone-400">
                      Si ninguna opción encaja, usa &quot;Cambiar estado manualmente&quot; más abajo.
                    </p>
                  </div>
                ) : siguientePaso ? (
                  <form action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                    <input type="hidden" name="siguientePasoNumero" value={siguientePaso.numero} />
                    <button
                      type="submit"
                      className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                    >
                      Marcar paso {pasoActual.numero} como completado → continuar al paso {siguientePaso.numero}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">
                    Este era el último paso del flujo. Si el trámite ya quedó resuelto, define el estado
                    final con &quot;Cambiar estado manualmente&quot; más abajo.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <SectionHelp>Este expediente no tiene un paso activo (el flujo no tiene pasos definidos).</SectionHelp>
          )}

          {/* Lista completa de pasos (referencia) */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Todos los pasos del flujo
            </h2>
            <ol className="space-y-1.5">
              {pasos.map((p) => {
                const estadoPaso =
                  p.numero < expediente.pasoActualNumero
                    ? "completado"
                    : p.numero === expediente.pasoActualNumero
                      ? "actual"
                      : "pendiente";
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                      estadoPaso === "actual"
                        ? "bg-cdmb-50 text-cdmb-900"
                        : estadoPaso === "completado"
                          ? "text-stone-400"
                          : "text-stone-400"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-semibold ${
                        estadoPaso === "completado"
                          ? "bg-green-100 text-green-700"
                          : estadoPaso === "actual"
                            ? "bg-cdmb-600 text-white"
                            : "bg-stone-100 text-stone-400"
                      }`}
                    >
                      {estadoPaso === "completado" ? "✓" : p.numero}
                    </span>
                    <span className={estadoPaso === "completado" ? "line-through decoration-stone-300" : ""}>
                      {p.titulo}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Cambio de estado manual */}
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-stone-900">Cambiar estado manualmente</h2>
            <p className="mb-3 text-xs text-stone-500">
              Úsalo para cerrar el expediente cuando el flujo no tiene un botón de decisión que encaje
              (por ejemplo, un archivo por desistimiento tácito, o para suspenderlo mientras se espera algo
              externo).
            </p>
            <form action={`/api/expedientes/${expediente.id}/estado`} method="post" className="flex flex-wrap items-end gap-3">
              <Field label="Nuevo estado" required help="">
                <select
                  name="estado"
                  defaultValue={expediente.estado}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo (opcional)" help="Queda registrado en la bitácora del expediente.">
                <input
                  name="motivo"
                  className="w-64 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                />
              </Field>
              <button
                type="submit"
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Guardar estado
              </button>
            </form>
          </section>

          {/* Bitácora */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Bitácora del expediente <span className="font-normal normal-case text-stone-400">— trazabilidad de todo lo que ha pasado</span>
            </h2>
            <form action={`/api/expedientes/${expediente.id}/comentario`} method="post" className="mb-3 flex gap-2">
              <input
                name="texto"
                placeholder="Agregar una nota o comentario al expediente…"
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button type="submit" className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                Comentar
              </button>
            </form>
            <ul className="space-y-3 border-l-2 border-stone-100 pl-4">
              {expediente.eventos.map((ev) => (
                <li key={ev.id}>
                  <EventoIcono tipo={ev.tipo} />
                  <p className="text-sm text-stone-700">{ev.descripcion}</p>
                  <p className="text-xs text-stone-400">
                    {ev.usuario.nombre} · {ev.createdAt.toLocaleString("es-CO")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Documentos */}
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white">
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-stone-900">Documentos del expediente</h3>
              <p className="text-xs text-stone-500">Todo lo adjuntado, de la radicación en adelante.</p>
            </div>
            {expediente.documentos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">Sin documentos todavía.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {expediente.documentos.map((doc) => (
                  <li key={doc.id} className="px-4 py-2.5 text-sm">
                    <a
                      href={`/api/documentos/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-cdmb-700 hover:underline"
                    >
                      📄 {doc.nombre}
                    </a>
                    {doc.descripcion && <p className="text-xs text-stone-500">{doc.descripcion}</p>}
                    <p className="text-xs text-stone-400">
                      {doc.pasoNumero ? `Paso ${doc.pasoNumero} · ` : ""}
                      {doc.subidoPor.nombre} · {doc.createdAt.toLocaleDateString("es-CO")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-500">
            <p>
              <span className="font-medium text-stone-700">Radicado:</span>{" "}
              {expediente.fechaRadicacion.toLocaleDateString("es-CO")}
            </p>
            <p>
              <span className="font-medium text-stone-700">Creado por:</span> {expediente.creadoPor.nombre}
            </p>
            {expediente.responsableActual && (
              <p>
                <span className="font-medium text-stone-700">A cargo de:</span> {expediente.responsableActual.nombre}
              </p>
            )}
          </div>

          {esTerminal && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              Este expediente ya llegó a un estado final (<EstadoBadge estado={expediente.estado} />) — se
              puede seguir documentando (por ejemplo, el seguimiento posterior), pero ya no está activo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
