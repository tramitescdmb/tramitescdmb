import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Paperclip, Reply, Send, UserCheck, Archive, PenLine, Hourglass, ShieldCheck, Ban } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos, marcarMemorandoLeido, numeroDeMemorando, whereVerMemorando } from "@/lib/memorandos";
import { fechaLargaMemorando, leerDatosMemorando, CIUDAD_MEMORANDO, GRUPOS_MASIVOS_MEMORANDO, type PersonaMemorando } from "@/lib/memorandos-formato";
import { cargoDelFirmante } from "@/lib/jerarquia-firma";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { urlBasePlataforma } from "@/lib/avisos-correo";
import { urlVerificacion } from "@/lib/rotulo";
import { formatearFechaHora } from "@/lib/fecha";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { leerEnvioMemorando, CALIDADES_COFIRMA_MEMORANDO } from "@/lib/memorandos-envio";
import { listarPlantillas } from "@/lib/plantillas";
import { DocumentoMemorando, type DatosDocumentoMemorando, type FirmaMemorandoDoc } from "@/components/memorandos/DocumentoMemorando";
import { DescargarPdfMemorando } from "@/components/memorandos/DescargarPdfMemorando";
import { BotonImprimir } from "@/components/BotonImprimir";
import { RespuestaFuncionarioForm } from "@/components/RespuestaFuncionarioForm";
import { EstadoComunicacionBadge } from "@/components/EstadoBadge";
import { BotonFirmarMemorando } from "@/components/memorandos/BotonFirmarMemorando";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Enviado",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignado",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Info. requerida",
  RESPONDIDA: "Respondido",
  ARCHIVADA: "Archivado",
  ANULADA: "Anulado",
};

const SELECT_PERSONA = {
  id: true,
  nombre: true,
  dependenciaId: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  denominacionEncargo: true,
  sexo: true,
  rolesContratacion: true,
} as const;

export default async function MemorandoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));

  const c = await db.comunicacion.findFirst({
    where: { id, AND: [whereVerMemorando(ctx)] },
    select: {
      id: true,
      radicado: true,
      anio: true,
      estado: true,
      asunto: true,
      contenido: true,
      fechaRadicacion: true,
      fechaVencimiento: true,
      datosMemorando: true,
      dependenciaOrigenId: true,
      dependenciaDestinoId: true,
      respuestaTexto: true,
      respuestaEn: true,
      radicadoPorId: true,
      respuestaPor: { select: { nombre: true } },
      dependenciaOrigen: { select: { nombre: true } },
      dependenciaDestino: { select: { nombre: true } },
      radicadoPor: { select: SELECT_PERSONA },
      respondeA: { select: { id: true, radicado: true } },
      respuestas: { select: { id: true, radicado: true }, orderBy: { fechaRadicacion: "desc" } },
      documentos: { select: { id: true, nombre: true, esRespuesta: true }, orderBy: { createdAt: "asc" } },
      firmas: {
        select: {
          id: true,
          usuarioId: true,
          calidad: true,
          fechaHora: true,
          hashContenido: true,
          formato: true,
          selloTiempoEn: true,
          selloTiempoFuente: true,
          cargoAlFirmar: true,
          usuario: { select: SELECT_PERSONA },
        },
        orderBy: { fechaHora: "asc" },
      },
      solicitudesFirma: {
        where: { rol: "FIRMA", calidad: { in: [...CALIDADES_COFIRMA_MEMORANDO] } },
        orderBy: { asignadoEn: "asc" },
        select: { id: true, usuarioAsignadoId: true, calidad: true, estado: true, comentario: true, usuarioAsignado: { select: { nombre: true } } },
      },
      distribuciones: {
        orderBy: { fechaAsignacion: "asc" },
        select: { activa: true, usuarioId: true, fechaAcuse: true, instrucciones: true, usuario: { select: SELECT_PERSONA } },
      },
    },
  });
  if (!c) notFound();
  await marcarMemorandoLeido(c.id, session.userId);

  const guardado = leerDatosMemorando(c.datosMemorando);
  const firma = c.firmas.find((f) => f.usuarioId === c.radicadoPorId) ?? c.firmas[0] ?? null;
  const persona = (u: (typeof c.distribuciones)[number]["usuario"] | null | undefined, cargo?: string | null): PersonaMemorando | null =>
    u ? { nombre: u.nombre, cargo: cargo || cargoDelFirmante(u, "SGDEA") } : null;
  const primerDestinatario = c.distribuciones.find((d) => d.usuario)?.usuario ?? null;

  const firmaDe = (usuarioId: string) => c.firmas.find((f) => f.usuarioId === usuarioId) ?? null;
  // Una firma rechazada se reemplaza si después se pide de nuevo: se muestra la solicitud más reciente de cada calidad.
  const solicitudDe = (calidad: "PROYECTO" | "REVISO") => c.solicitudesFirma.filter((x) => x.calidad === calidad).at(-1) ?? null;
  const solicitudesVigentes = (["PROYECTO", "REVISO"] as const).map(solicitudDe).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const estadoFirma = (calidad: "PROYECTO" | "REVISO"): string | null => {
    const s = solicitudDe(calidad);
    if (!s) return null;
    const f = firmaDe(s.usuarioAsignadoId);
    if (f) return `Firmó electrónicamente el ${formatearFechaHora(f.fechaHora)}`;
    return s.estado === "RECHAZADA" ? "Firma rechazada" : "Pendiente de firma";
  };
  const miSolicitud = c.solicitudesFirma.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE") ?? null;
  const pendientesFirma = c.solicitudesFirma.filter((s) => s.estado === "PENDIENTE");
  const rechazadas = c.solicitudesFirma.filter((s) => s.estado === "RECHAZADA");
  // Retenido: aún no se entrega a los destinatarios (faltan firmas de proyectó / revisó o alguna se rechazó).
  const enFirma = c.estado !== "ANULADA" && (pendientesFirma.length > 0 || rechazadas.length > 0);
  const envio = leerEnvioMemorando(c.datosMemorando);

  const ETIQUETA_CALIDAD: Record<string, string> = { PRINCIPAL: "Firmante principal", PROYECTO: "Proyectó", REVISO: "Revisó" };
  const metadatosFirma = (f: (typeof c.firmas)[number] | null): FirmaMemorandoDoc | null =>
    f
      ? {
          id: f.id,
          nombre: f.usuario.nombre,
          cargo: f.cargoAlFirmar || cargoDelFirmante(f.usuario, "SGDEA"),
          calidad: ETIQUETA_CALIDAD[f.calidad ?? "PRINCIPAL"] ?? null,
          fecha: formatearFechaHora(f.fechaHora),
          hash: f.hashContenido,
          formato: etiquetaFormatoFirma(f.formato),
          sello: f.selloTiempoEn ? `${f.selloTiempoFuente ?? "Sello de tiempo"} — ${formatearFechaHora(f.selloTiempoEn)}` : null,
        }
      : null;
  const firmaCofirmante = (calidad: "PROYECTO" | "REVISO") => {
    const s = solicitudDe(calidad);
    return s ? metadatosFirma(firmaDe(s.usuarioAsignadoId)) : null;
  };

  const h = await headers();
  const config = await getConfiguracionSitio();
  const base = urlBasePlataforma(("urlPlataforma" in config ? config.urlPlataforma : null) ?? null) ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  const datos: DatosDocumentoMemorando = {
    numero: guardado?.numero ?? (await numeroDeMemorando(c)),
    ciudad: guardado?.ciudad ?? CIUDAD_MEMORANDO,
    fecha: fechaLargaMemorando(c.fechaRadicacion),
    para: guardado?.para ?? persona(primerDestinatario) ?? (c.dependenciaDestino ? { nombre: c.dependenciaDestino.nombre, cargo: "" } : null),
    de: guardado?.de ?? persona(c.radicadoPor, firma?.cargoAlFirmar),
    asunto: c.asunto,
    cuerpo: c.contenido ?? "",
    proyecto: guardado?.proyecto ?? null,
    reviso: guardado?.reviso ?? null,
    estadoProyecto: estadoFirma("PROYECTO"),
    estadoReviso: estadoFirma("REVISO"),
    oficina: guardado?.oficina ?? c.dependenciaOrigen?.nombre ?? "",
    firma: metadatosFirma(firma),
    firmaProyecto: firmaCofirmante("PROYECTO"),
    firmaReviso: firmaCofirmante("REVISO"),
    verificacion: { radicado: c.radicado, url: urlVerificacion(base, c.radicado), radicadoEn: formatearFechaHora(c.fechaRadicacion) },
  };

  const vigentes = c.distribuciones.filter((d) => d.activa);
  const masivo = guardado?.masivo ?? null;
  const leidos = vigentes.filter((d) => d.fechaAcuse).length;
  // En un masivo, la lista de a quién llegó la ven quien lo firmó, quien dirige la oficina de origen y gestión documental.
  const verEntregas = !masivo || c.radicadoPorId === session.userId || ctx.archivo || (ctx.firmante && Boolean(ctx.dependenciaId) && ctx.dependenciaId === c.dependenciaOrigenId);
  // Los dirigidos a una dependencia se responden (con o sin plazo); los masivos son informativos.
  const respondible = !masivo && Boolean(c.dependenciaDestinoId);
  const pendiente = respondible && !enFirma && !["RESPONDIDA", "ANULADA", "ARCHIVADA"].includes(c.estado) && c.respuestas.length === 0;
  const puedeAnular = enFirma && (c.radicadoPorId === session.userId || ctx.archivo);
  const dirigeDestino = ctx.firmante && Boolean(ctx.dependenciaId) && ctx.dependenciaId === c.dependenciaDestinoId;
  const asignadoAMi = vigentes.some((d) => d.usuarioId === session.userId);
  const puedeProyectar = pendiente && asignadoAMi && !ctx.firmante;
  const colaboradores = dirigeDestino && pendiente
    ? await db.usuario.findMany({ where: { activo: true, dependenciaId: ctx.dependenciaId!, id: { not: session.userId } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } })
    : [];
  const plantillasRespuesta = puedeProyectar ? await listarPlantillas("INTERNA") : [];
  const adjuntos = c.documentos.filter((d) => !d.esRespuesta);
  const adjuntosRespuesta = c.documentos.filter((d) => d.esRespuesta);
  const idDocumento = `memorando-${c.id}`;

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: letter; margin: 15mm 18mm } body { background: #fff } .encabezado-modulo, .no-imprimir { display: none !important } }`}</style>
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-2">
        <Link href="/memorandos" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la bandeja
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <BotonImprimir variante="secundario">Imprimir</BotonImprimir>
          <DescargarPdfMemorando datos={datos} nombreArchivo={`Memorando ${datos.numero ?? c.radicado}`} />
        </div>
      </div>
      {sp.ok && <div className="no-imprimir rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="no-imprimir rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-stone-200 bg-white shadow-soft print:border-0 print:shadow-none">
          <DocumentoMemorando id={idDocumento} d={datos} />
        </div>

        <aside className="no-imprimir space-y-4">
          {enFirma && (
            <section className={`rounded-2xl border p-4 text-sm shadow-soft ${rechazadas.length > 0 ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="flex items-center gap-1.5 font-semibold">
                <Hourglass className="h-4 w-4" aria-hidden />
                {rechazadas.length > 0 ? "No se entregó: una firma fue rechazada" : "Aún no se ha entregado a los destinatarios"}
              </p>
              {rechazadas.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {rechazadas.map((r) => (
                    <li key={r.id}>
                      {r.usuarioAsignado.nombre} rechazó la firma{r.comentario ? `: «${r.comentario}»` : "."}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">
                  Espera la firma de {pendientesFirma.map((p) => p.usuarioAsignado.nombre).join(" y ")}. Con la última firma se entrega automáticamente
                  {envio?.plazoRespuestaDias ? ` y empieza a contar el plazo de ${envio.plazoRespuestaDias} días hábiles` : ""}.
                </p>
              )}
              {puedeAnular && (
                <form action={`/api/memorandos/${c.id}/anular`} method="post" className="mt-3 space-y-2 border-t border-current/10 pt-3">
                  <label className="block text-xs font-medium" htmlFor="motivo-anulacion">
                    Anular este memorando (no se ha entregado a nadie)
                  </label>
                  <input id="motivo-anulacion" name="motivo" required placeholder="Motivo de la anulación" className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-800" />
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                    <Ban className="h-4 w-4" aria-hidden />
                    Anular memorando
                  </button>
                </form>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-stone-500">{c.radicado}</span>
              <EstadoComunicacionBadge estado={enFirma ? "EN_REPARTO" : c.estado} etiqueta={enFirma ? (rechazadas.length > 0 ? "Firma rechazada" : "En firma") : ETIQUETA_ESTADO[c.estado] ?? c.estado} />
            </div>
            <dl className="mt-3 space-y-1.5 text-stone-700">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">De</dt>
                <dd className="text-right">{c.dependenciaOrigen?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Para</dt>
                <dd className="text-right">{masivo ? GRUPOS_MASIVOS_MEMORANDO[masivo.grupo].etiqueta : c.dependenciaDestino?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Responder antes de</dt>
                <dd className="text-right">
                  {c.fechaVencimiento
                    ? formatearFechaHora(c.fechaVencimiento)
                    : !respondible
                      ? "Informativo"
                      : enFirma && envio?.plazoRespuestaDias
                        ? `${envio.plazoRespuestaDias} días hábiles desde la entrega`
                        : "Sin plazo fijo"}
                </dd>
              </div>
              {firma && (
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Firmado</dt>
                  <dd className="text-right">{formatearFechaHora(firma.fechaHora)}</dd>
                </div>
              )}
            </dl>
            {c.respondeA && (
              <Link href={`/memorandos/${c.respondeA.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-cdmb-700 hover:underline">
                <Reply className="h-3 w-3" aria-hidden />
                Responde a {c.respondeA.radicado}
              </Link>
            )}
            {c.respuestas.map((r) => (
              <Link key={r.id} href={`/memorandos/${r.id}`} className="mt-1 block text-xs text-cdmb-700 hover:underline">
                Respondido con {r.radicado}
              </Link>
            ))}
            {ctx.archivo && (
              <Link href={`/correspondencia/${c.id}`} className="mt-3 flex items-center gap-1 text-xs text-stone-500 hover:text-cdmb-700">
                <Archive className="h-3 w-3" aria-hidden />
                Ver el registro de archivo en el SGDEA
              </Link>
            )}
          </section>

          {(solicitudesVigentes.length > 0 || miSolicitud) && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <PenLine className="h-4 w-4" aria-hidden />
                Firmas de proyectó y revisó
              </h2>
              <ul className="space-y-1">
                {solicitudesVigentes.map((s) => {
                  const f = firmaDe(s.usuarioAsignadoId);
                  return (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span>
                        {s.usuarioAsignado.nombre} <span className="text-xs text-stone-500">({s.calidad === "REVISO" ? "Revisó" : "Proyectó"})</span>
                      </span>
                      <span className={`text-xs ${f ? "text-emerald-700" : s.estado === "RECHAZADA" ? "text-red-700" : "text-amber-700"}`}>
                        {f ? `Firmó ${formatearFechaHora(f.fechaHora)}` : s.estado === "RECHAZADA" ? "Rechazó" : "Pendiente"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {miSolicitud && c.estado !== "ANULADA" && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <BotonFirmarMemorando comunicacionId={c.id} solicitudId={miSolicitud.id} calidad={miSolicitud.calidad === "REVISO" ? "revisó" : "proyectó"} asunto={c.asunto} />
                </div>
              )}
            </section>
          )}

          {(vigentes.length > 0 || c.distribuciones.length > 0) && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <UserCheck className="h-4 w-4" aria-hidden />
                {enFirma ? "Se entregará a" : masivo ? "Entregado a" : "Asignado a"}
              </h2>
              {masivo && (
                <p className="text-stone-700">
                  {vigentes.length} persona{vigentes.length === 1 ? "" : "s"}
                  {!enFirma && ` · ${leidos} lo ${leidos === 1 ? "ha" : "han"} leído`}
                  <span className="mt-0.5 block text-xs text-stone-500">Envío masivo: llegó como notificación en la plataforma, sin correo.</span>
                </p>
              )}
              {masivo && verEntregas && vigentes.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-cdmb-700">Ver a quién llegó y quién lo leyó</summary>
                  <ul className="mt-2 max-h-80 space-y-1 overflow-auto pr-1">
                    {vigentes.map((d, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{d.usuario?.nombre ?? "—"}</span>
                        <span className="whitespace-nowrap text-xs text-stone-500">{d.fechaAcuse ? `Leído ${formatearFechaHora(d.fechaAcuse)}` : "Sin leer"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!masivo && (
              <ul className="space-y-1">
                {vigentes.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{d.usuario?.nombre ?? "La dependencia"}</span>
                    <span className="text-xs text-stone-500">{enFirma ? "Pendiente de entrega" : d.fechaAcuse ? `Leído ${formatearFechaHora(d.fechaAcuse)}` : "Sin leer"}</span>
                  </li>
                ))}
              </ul>
              )}
              {dirigeDestino && pendiente && colaboradores.length > 0 && (
                <form action={`/api/memorandos/${c.id}/asignar`} method="post" className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                  <label className="block text-xs font-medium text-stone-600" htmlFor="usuarioId">
                    Asignar a un colaborador para que proyecte la respuesta
                  </label>
                  <select id="usuarioId" name="usuarioId" required className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm">
                    <option value="">— Seleccione —</option>
                    {colaboradores.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                  <input name="instrucciones" placeholder="Instrucciones (opcional)" className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm" />
                  <button type="submit" className="rounded-md border border-cdmb-300 px-3 py-1.5 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50">
                    Asignar
                  </button>
                </form>
              )}
            </section>
          )}

          {c.firmas.length > 0 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                Firmas electrónicas
              </h2>
              <ul className="space-y-3">
                {c.firmas.map((f) => {
                  const m = metadatosFirma(f)!;
                  return (
                    <li key={f.id} className="rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
                      <p className="font-medium text-stone-900">
                        {m.nombre} <span className="font-normal text-stone-500">— {m.cargo}</span>
                      </p>
                      <dl className="mt-1.5 grid grid-cols-1 gap-y-1 text-xs">
                        <DatoFirma k="Calidad" v={m.calidad ?? "—"} />
                        <DatoFirma k="Fecha y hora" v={`${m.fecha} (hora de Colombia)`} />
                        <DatoFirma k="Mecanismo" v={m.formato ?? "—"} />
                        <DatoFirma k="Código de la firma" v={f.id} mono />
                        <DatoFirma k="Huella SHA-256 del contenido" v={f.hashContenido} mono />
                        {m.sello && <DatoFirma k="Sello de tiempo" v={m.sello} />}
                      </dl>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-stone-500">
                Radicado {c.radicado} · {formatearFechaHora(c.fechaRadicacion)}. Se verifica en{" "}
                <a href={datos.verificacion!.url} className="break-all text-cdmb-700 hover:underline">
                  {datos.verificacion!.url}
                </a>
                .
              </p>
            </section>
          )}

          {adjuntos.length > 0 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <Paperclip className="h-4 w-4" aria-hidden />
                Anexos
              </h2>
              <ul className="space-y-1">
                {adjuntos.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/memorandos/documentos/${d.id}`} target="_blank" rel="noreferrer" className="text-cdmb-700 hover:underline">
                      {d.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {respondible && (c.respuestaTexto || puedeProyectar || (dirigeDestino && pendiente)) && (
            <section id="proyectar" className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <Reply className="h-4 w-4" aria-hidden />
                Respuesta
              </h2>
              {c.respuestaTexto && (
                <div className="mb-3 rounded border border-stone-200 bg-stone-50 p-3">
                  <p className="whitespace-pre-wrap text-stone-700">{c.respuestaTexto}</p>
                  <p className="mt-2 text-xs text-stone-400">
                    Proyectó: {c.respuestaPor?.nombre ?? "—"} · {c.respuestaEn ? formatearFechaHora(c.respuestaEn) : ""}
                  </p>
                  {adjuntosRespuesta.map((d) => (
                    <a key={d.id} href={`/api/memorandos/documentos/${d.id}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-cdmb-700 hover:underline">
                      {d.nombre}
                    </a>
                  ))}
                </div>
              )}
              {puedeProyectar && (
                <RespuestaFuncionarioForm
                  memorando
                  comunicacionId={c.id}
                  textoInicial={c.respuestaTexto ?? ""}
                  plantillas={plantillasRespuesta}
                  contexto={{ RADICADO: c.radicado, ASUNTO: c.asunto, DESTINATARIO: c.dependenciaOrigen?.nombre ?? "", REMITENTE: c.dependenciaOrigen?.nombre ?? "", FUNCIONARIO: session.nombre }}
                />
              )}
              {dirigeDestino && pendiente && (
                <Link
                  href={`/memorandos/nuevo?respondeAId=${c.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Firmar y enviar la respuesta
                </Link>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DatoFirma({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-stone-400">{k}</dt>
      <dd className={`break-all text-stone-800 ${mono ? "font-mono text-[11px]" : ""}`}>{v}</dd>
    </div>
  );
}
