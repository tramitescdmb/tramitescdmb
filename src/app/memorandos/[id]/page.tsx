import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Paperclip, Reply, Send, UserCheck, Archive, PenLine } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos, marcarMemorandoLeido, numeroDeMemorando, whereVerMemorando } from "@/lib/memorandos";
import { fechaLargaMemorando, leerDatosMemorando, CIUDAD_MEMORANDO, type PersonaMemorando } from "@/lib/memorandos-formato";
import { cargoDelFirmante } from "@/lib/jerarquia-firma";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { urlBasePlataforma } from "@/lib/avisos-correo";
import { urlVerificacion } from "@/lib/rotulo";
import { formatearFechaHora } from "@/lib/fecha";
import { listarPlantillas } from "@/lib/plantillas";
import { DocumentoMemorando, type DatosDocumentoMemorando } from "@/components/memorandos/DocumentoMemorando";
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
      firmas: { select: { usuarioId: true, fechaHora: true, hashContenido: true, selloTiempoFuente: true, cargoAlFirmar: true }, orderBy: { fechaHora: "asc" } },
      solicitudesFirma: {
        where: { rol: "FIRMA", estado: { not: "RECHAZADA" } },
        orderBy: { asignadoEn: "asc" },
        select: { id: true, usuarioAsignadoId: true, calidad: true, estado: true, usuarioAsignado: { select: { nombre: true } } },
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
  const estadoFirma = (calidad: "PROYECTO" | "REVISO"): string | null => {
    const s = c.solicitudesFirma.find((x) => x.calidad === calidad);
    if (!s) return null;
    const f = firmaDe(s.usuarioAsignadoId);
    return f ? `Firmó electrónicamente el ${formatearFechaHora(f.fechaHora)}` : "Pendiente de firma";
  };
  const miSolicitud = c.solicitudesFirma.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE") ?? null;

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
    firma: firma ? { fecha: formatearFechaHora(firma.fechaHora), hash: firma.hashContenido, sello: firma.selloTiempoFuente } : null,
    verificacion: { radicado: c.radicado, url: urlVerificacion(base, c.radicado) },
  };

  const vigentes = c.distribuciones.filter((d) => d.activa);
  const pendiente = Boolean(c.fechaVencimiento) && !["RESPONDIDA", "ANULADA", "ARCHIVADA"].includes(c.estado) && c.respuestas.length === 0;
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
          <DescargarPdfMemorando idDocumento={idDocumento} nombreArchivo={`Memorando ${datos.numero ?? c.radicado}`} />
        </div>
      </div>
      {sp.ok && <div className="no-imprimir rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="no-imprimir rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-stone-200 bg-white shadow-soft print:border-0 print:shadow-none">
          <DocumentoMemorando id={idDocumento} d={datos} logoUrl={config.logoUrl} />
        </div>

        <aside className="no-imprimir space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-stone-500">{c.radicado}</span>
              <EstadoComunicacionBadge estado={c.estado} etiqueta={ETIQUETA_ESTADO[c.estado] ?? c.estado} />
            </div>
            <dl className="mt-3 space-y-1.5 text-stone-700">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">De</dt>
                <dd className="text-right">{c.dependenciaOrigen?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Para</dt>
                <dd className="text-right">{c.dependenciaDestino?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Responder antes de</dt>
                <dd className="text-right">{c.fechaVencimiento ? formatearFechaHora(c.fechaVencimiento) : "Informativo"}</dd>
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

          {(c.solicitudesFirma.length > 0 || miSolicitud) && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
                <PenLine className="h-4 w-4" aria-hidden />
                Firmas de proyectó y revisó
              </h2>
              <ul className="space-y-1">
                {c.solicitudesFirma.map((s) => {
                  const f = firmaDe(s.usuarioAsignadoId);
                  return (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span>
                        {s.usuarioAsignado.nombre} <span className="text-xs text-stone-500">({s.calidad === "REVISO" ? "Revisó" : "Proyectó"})</span>
                      </span>
                      <span className={`text-xs ${f ? "text-emerald-700" : "text-amber-700"}`}>{f ? `Firmó ${formatearFechaHora(f.fechaHora)}` : "Pendiente"}</span>
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
                Asignado a
              </h2>
              <ul className="space-y-1">
                {vigentes.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{d.usuario?.nombre ?? "La dependencia"}</span>
                    <span className="text-xs text-stone-500">{d.fechaAcuse ? `Leído ${formatearFechaHora(d.fechaAcuse)}` : "Sin leer"}</span>
                  </li>
                ))}
              </ul>
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

          {c.fechaVencimiento && (c.respuestaTexto || puedeProyectar || (dirigeDestino && pendiente)) && (
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
