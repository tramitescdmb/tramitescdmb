import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EstadoBadge } from "@/components/EstadoBadge";
import { infoEvento } from "@/components/EventoIcono";
import { Field, SectionHelp } from "@/components/Field";
import { SubirDocumentoPasoForm } from "@/components/SubirDocumentoPasoForm";
import { cargoCoincideConPaso, cargoCanonico } from "@/lib/cargos";
import { documentoEtapaAbierta } from "@/lib/documentos";
import { EliminarDocumentoBoton } from "@/components/EliminarDocumentoBoton";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { CapturarVisitaTecnica } from "@/components/CapturarVisitaTecnica";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";

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

const formatoFechaHistoria = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [expediente, usuariosActivos, cargos] = await Promise.all([
    db.expediente.findUnique({
      where: { id },
      include: {
        tramiteTipo: true,
        flujo: { include: { pasos: { orderBy: { numero: "asc" } } } },
        documentos: { orderBy: { createdAt: "desc" }, include: { subidoPor: true } },
        eventos: { orderBy: { createdAt: "asc" }, include: { usuario: true } },
        visitasTecnicas: { orderBy: { createdAt: "desc" }, include: { capturadoPor: true } },
        creadoPor: true,
        responsableActual: true,
        usuariosAsignados: true,
        cargosAsignados: true,
        solicitante: true,
      },
    }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, cargo: { select: { nombre: true } } } }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
  ]);

  if (!expediente) notFound();

  const session = await getSession();
  const pasos = expediente.flujo.pasos;
  const currentIndex = pasos.findIndex((p) => p.numero === expediente.pasoActualNumero);
  const pasoActual = currentIndex >= 0 ? pasos[currentIndex] : null;
  const siguientePaso = currentIndex >= 0 ? pasos[currentIndex + 1] : null;
  const esTerminal = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"].includes(expediente.estado);
  const esMiPaso = pasoActual ? cargoCoincideConPaso(session?.cargo, pasoActual.responsables) : false;
  const visitasDelPasoActual = pasoActual
    ? expediente.visitasTecnicas.filter((v) => v.pasoNumero === pasoActual.numero)
    : [];

  // Agrupa los documentos por paso (null = subidos en la radicación) para mostrarlos en
  // tarjetas separadas — con todo junto en una sola lista no se distinguía a qué etapa
  // pertenecía cada archivo.
  const gruposDocumentos: Array<[number | null, typeof expediente.documentos]> = [];
  for (const doc of expediente.documentos) {
    let grupo = gruposDocumentos.find(([num]) => num === doc.pasoNumero);
    if (!grupo) {
      grupo = [doc.pasoNumero, []];
      gruposDocumentos.push(grupo);
    }
    grupo[1].push(doc);
  }
  gruposDocumentos.sort(([a], [b]) => (a ?? -1) - (b ?? -1));

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
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">
                  {expediente.solicitanteTipo === "JURIDICA" ? "NIT" : "Cédula de ciudadanía"}
                </dt>
                <dd className="break-words text-stone-800">{expediente.solicitanteIdentificacion}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Nombre / razón social</dt>
                <dd className="break-words text-stone-800">{expediente.solicitanteNombre}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Correo</dt>
                <dd className="break-all text-stone-800">{expediente.solicitanteEmail ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Teléfono</dt>
                <dd className="break-words text-stone-800">{expediente.solicitanteTelefono ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Municipio</dt>
                <dd className="break-words text-stone-800">{expediente.municipio}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Dirección del solicitante</dt>
                <dd className="break-words text-stone-800">{expediente.solicitanteDireccion ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Dirección donde se adelanta el trámite</dt>
                <dd className="break-words text-stone-800">{expediente.predioDireccion ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Régimen tributario</dt>
                <dd className="break-words text-stone-800">{regimenTributarioLabel(expediente.solicitante?.regimenTributario)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Gran contribuyente</dt>
                <dd className="text-stone-800">{expediente.solicitante?.granContribuyente ? "Sí" : "No"}</dd>
              </div>
            </dl>

            <BloqueDatosPredio
              claseSolicitud={expediente.claseSolicitud}
              nombre={expediente.predioNombre}
              catastral={expediente.predioCatastral}
              matricula={expediente.predioMatricula}
              areaM2={expediente.predioAreaM2}
              areaCultivosM2={expediente.predioAreaCultivosM2}
              areaBosqueM2={expediente.predioAreaBosqueM2}
              viviendas={expediente.predioViviendas}
            />

            <BloqueUbicacion
              titulo="📍 Ubicación del lugar del trámite"
              lat={expediente.ubicacionLat}
              lon={expediente.ubicacionLon}
              planaX={expediente.ubicacionPlanaX}
              planaY={expediente.ubicacionPlanaY}
              cartX={expediente.ubicacionCartesianaX}
              cartY={expediente.ubicacionCartesianaY}
              cartZ={expediente.ubicacionCartesianaZ}
            />
            <BloqueUbicacion
              titulo="📍 Ubicación del solicitante"
              lat={expediente.solicitanteUbicacionLat}
              lon={expediente.solicitanteUbicacionLon}
              planaX={expediente.solicitanteUbicacionPlanaX}
              planaY={expediente.solicitanteUbicacionPlanaY}
              cartX={expediente.solicitanteUbicacionCartesianaX}
              cartY={expediente.solicitanteUbicacionCartesianaY}
              cartZ={expediente.solicitanteUbicacionCartesianaZ}
            />
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
                    ✋ Corresponde a su cargo ({session?.cargo})
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-stone-900">{pasoActual.titulo}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{pasoActual.descripcion}</p>

              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                {pasoActual.responsables.length > 0 && (
                  <div>
                    <dt className="font-medium text-stone-500">👤 Responsable</dt>
                    <dd className="text-stone-700">
                      {Array.from(new Set(pasoActual.responsables.map(cargoCanonico))).join(", ")}
                    </dd>
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
                <SubirDocumentoPasoForm
                  expedienteId={expediente.id}
                  pasoNumero={pasoActual.numero}
                  documentosDelPaso={pasoActual.documentos}
                />
              </div>

              {/* Geoposición de la visita técnica — disponible en cualquier paso, no todos los
                  trámites lo requieren pero la mayoría sí tiene un paso de "visita técnica" que
                  pide geo-referenciar el predio (ver data/tramites/*.json). */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Geoposición de la visita técnica (opcional)
                </h3>
                {visitasDelPasoActual.length > 0 && (
                  <ul className="mb-3 space-y-3">
                    {visitasDelPasoActual.map((v) => (
                      <li key={v.id} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                        <MapaSoloLectura lat={v.lat} lon={v.lon} />
                        <p className="mt-2 text-xs text-stone-600">
                          Latitud/longitud: {v.lat.toFixed(6)}, {v.lon.toFixed(6)}
                          {v.precisionM != null && <> · Precisión reportada: ±{Math.round(v.precisionM)} m</>}
                        </p>
                        {v.nota && <p className="text-xs text-stone-600">Nota: {v.nota}</p>}
                        <p className="mt-0.5 text-xs text-stone-400">
                          {v.capturadoPor.nombre} · {formatoFechaHistoria.format(v.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <CapturarVisitaTecnica expedienteId={expediente.id} pasoNumero={pasoActual.numero} />
              </div>

              {/* Acciones para avanzar */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                {pasoActual.esDecision ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-stone-500">
                      ⚠ Este paso requiere una decisión. Seleccione la opción correspondiente para que el
                      expediente siga el camino correcto:
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
                      Si ninguna opción corresponde, utilice &quot;Cambiar estado manualmente&quot; más abajo.
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
                    Este es el último paso del flujo. Si el trámite ya quedó resuelto, debe definirse el
                    estado final mediante &quot;Cambiar estado manualmente&quot; más abajo.
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
              Utilice esta opción para cerrar el expediente cuando el flujo no cuenta con un botón de
              decisión que corresponda (por ejemplo, un archivo por desistimiento tácito, o para
              suspenderlo mientras se espera información externa).
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

          {/* Historia del expediente — línea de tiempo */}
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-stone-900">Historia del expediente</h2>
            <p className="mb-3 text-xs text-stone-500">
              La hoja de vida completa: qué pasó, cuándo y quién lo hizo — desde que se radicó hasta hoy.
            </p>
            <form action={`/api/expedientes/${expediente.id}/comentario`} method="post" className="mb-4 flex gap-2">
              <input
                name="texto"
                placeholder="Agregar una nota o comentario al expediente…"
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button type="submit" className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                Comentar
              </button>
            </form>

            <ol>
              {expediente.eventos.map((ev, idx) => {
                const info = infoEvento(ev.tipo);
                const esUltimo = idx === expediente.eventos.length - 1;
                return (
                  <li key={ev.id} className="relative flex gap-3 pb-5">
                    {!esUltimo && (
                      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-stone-200" aria-hidden />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm ${info.clase}`}
                      aria-hidden
                    >
                      {info.icono}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm text-stone-700">{ev.descripcion}</p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        <span className="font-medium text-stone-500">{ev.usuario.nombre}</span>
                        {" · "}
                        {formatoFechaHistoria.format(ev.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Documentos */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="px-1">
              <h3 className="text-sm font-semibold text-stone-900">Documentos del expediente</h3>
              <p className="text-xs text-stone-500">Agrupados por paso, de la radicación en adelante.</p>
            </div>

            {expediente.documentos.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-400">
                Sin documentos todavía.
              </div>
            ) : (
              gruposDocumentos.map(([numeroPaso, docs]) => {
                const tituloPaso = numeroPaso == null ? null : pasos.find((p) => p.numero === numeroPaso)?.titulo;
                return (
                  <div key={numeroPaso ?? "radicacion"} className="rounded-xl border border-stone-200 bg-white">
                    <div className="border-b border-stone-100 bg-stone-50 px-4 py-2 rounded-t-xl">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cdmb-700">
                        {numeroPaso == null
                          ? "📥 Documentos de radicación"
                          : `Paso ${numeroPaso}${tituloPaso ? ` · ${tituloPaso}` : ""}`}
                      </p>
                    </div>
                    <ul className="divide-y divide-stone-100">
                      {docs.map((doc) => (
                        <li key={doc.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
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
                              {doc.subidoPor.nombre} · {doc.createdAt.toLocaleDateString("es-CO")}
                            </p>
                          </div>
                          {(() => {
                            const abierta = documentoEtapaAbierta(doc.pasoNumero, expediente.pasoActualNumero);
                            const puede =
                              session?.rol === "ADMIN" || (abierta && session?.userId === doc.subidoPorId);
                            return (
                              <EliminarDocumentoBoton
                                documentoId={doc.id}
                                nombre={doc.nombre}
                                etapaAbierta={abierta}
                                puedeEliminar={puede}
                              />
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
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

          {/* Asignación del expediente */}
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-stone-900">Asignado a</h3>
            <p className="mb-2 text-xs text-stone-500">
              Quién(es) deben trabajar este expediente — usuarios puntuales y/o cargos completos.
              Es informativo: cualquier funcionario sigue pudiendo actuar sobre el expediente.
            </p>
            {expediente.usuariosAsignados.length === 0 && expediente.cargosAsignados.length === 0 ? (
              <p className="text-sm text-stone-400">Sin asignar todavía.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {expediente.usuariosAsignados.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-cdmb-50 px-2.5 py-1 text-xs font-medium text-cdmb-800">
                    👤 {u.nombre}
                  </span>
                ))}
                {expediente.cargosAsignados.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    🏷️ {c.nombre}
                  </span>
                ))}
              </div>
            )}

            {session?.rol === "ADMIN" && (
              <details className="mt-3 group">
                <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
                  Editar asignación
                </summary>
                <form action={`/api/expedientes/${expediente.id}/asignar`} method="post" className="mt-2 space-y-3 border-t border-stone-100 pt-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-stone-700">Usuarios puntuales</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
                      {usuariosActivos.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            name="usuarioIds"
                            value={u.id}
                            defaultChecked={expediente.usuariosAsignados.some((a) => a.id === u.id)}
                          />
                          {u.nombre}
                          {u.cargo && <span className="text-xs text-stone-400"> — {u.cargo.nombre}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-stone-700">Cargos completos</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
                      {cargos.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            name="cargoIds"
                            value={c.id}
                            defaultChecked={expediente.cargosAsignados.some((a) => a.id === c.id)}
                          />
                          {c.nombre}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700"
                  >
                    Guardar asignación
                  </button>
                </form>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Solo se muestra si el expediente tiene al menos un dato de este bloque — la mayoría son opcionales. */
function BloqueDatosPredio({
  claseSolicitud,
  nombre,
  catastral,
  matricula,
  areaM2,
  areaCultivosM2,
  areaBosqueM2,
  viviendas,
}: {
  claseSolicitud: string | null;
  nombre: string | null;
  catastral: string | null;
  matricula: string | null;
  areaM2: number | null;
  areaCultivosM2: number | null;
  areaBosqueM2: number | null;
  viviendas: number | null;
}) {
  const hayDatos =
    claseSolicitud || nombre || catastral || matricula || areaM2 != null || areaCultivosM2 != null || areaBosqueM2 != null || viviendas != null;
  if (!hayDatos) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Datos adicionales del predio</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {claseSolicitud && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Clase de solicitud</dt>
            <dd className="text-stone-800">{claseSolicitud === "RENOVACION" ? "Renovación" : "Nueva"}</dd>
          </div>
        )}
        {nombre && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nombre del predio</dt>
            <dd className="break-words text-stone-800">{nombre}</dd>
          </div>
        )}
        {catastral && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nro. Catastral</dt>
            <dd className="break-words text-stone-800">{catastral}</dd>
          </div>
        )}
        {matricula && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Matrícula inmobiliaria</dt>
            <dd className="break-words text-stone-800">{matricula}</dd>
          </div>
        )}
        {areaM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área predial</dt>
            <dd className="text-stone-800">{areaM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {areaCultivosM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área en cultivos</dt>
            <dd className="text-stone-800">{areaCultivosM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {areaBosqueM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área en bosque</dt>
            <dd className="text-stone-800">{areaBosqueM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {viviendas != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nro. de viviendas</dt>
            <dd className="text-stone-800">{viviendas.toLocaleString("es-CO")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Colapsado por defecto — mostrar el mapa y las 3 coordenadas siempre expandidas
 * (aún más si hay dos: predio y solicitante) sumaba mucho texto/mapa a la página.
 * Un resumen de una línea y el detalle solo si el usuario lo pide.
 */
function BloqueUbicacion({
  titulo,
  lat,
  lon,
  planaX,
  planaY,
  cartX,
  cartY,
  cartZ,
}: {
  titulo: string;
  lat: number | null;
  lon: number | null;
  planaX: number | null;
  planaY: number | null;
  cartX: number | null;
  cartY: number | null;
  cartZ: number | null;
}) {
  if (lat == null || lon == null) return null;
  return (
    <details className="mt-3 border-t border-stone-100 pt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-stone-500 [&::-webkit-details-marker]:hidden">
        {titulo} — {lat.toFixed(6)}, {lon.toFixed(6)} <span className="text-cdmb-700">(ver mapa y coordenadas)</span>
      </summary>
      <div className="mt-2 space-y-2">
        <MapaSoloLectura lat={lat} lon={lon} />
        <div className="space-y-0.5 text-stone-700">
          <p>
            Elipsoidales (lat/lon, WGS84): {lat.toFixed(6)}, {lon.toFixed(6)}
          </p>
          {planaX != null && planaY != null && (
            <p>
              Planas (MAGNA-SIRGAS Origen-Nacional): X {planaX.toLocaleString("es-CO")} m, Y{" "}
              {planaY.toLocaleString("es-CO")} m
            </p>
          )}
          {cartX != null && cartY != null && cartZ != null && (
            <p>
              Cartesianas (ECEF): X {cartX.toLocaleString("es-CO")} m, Y {cartY.toLocaleString("es-CO")} m, Z{" "}
              {cartZ.toLocaleString("es-CO")} m
            </p>
          )}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-cdmb-700 hover:underline"
          >
            Abrir en OpenStreetMap ↗
          </a>
        </div>
      </div>
    </details>
  );
}
