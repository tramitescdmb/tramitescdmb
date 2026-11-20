import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, puedeEditarExpediente } from "@/lib/permisos";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";
import { tramiteFinalizado } from "@/lib/estados-expediente";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { interpretarPlazo, validarItems } from "@/lib/correccion-solicitud";
import { avisarCorreccionAlCiudadano } from "@/lib/correccion-solicitud-db";
import { formatearFechaLarga } from "@/lib/fecha";

/**
 * «Devolver para corrección»: la solicitud en línea vuelve al ciudadano en el mismo expediente, con
 * la lista de documentos a corregir o aportar y un plazo. El expediente pasa a «Información
 * adicional requerida» hasta que el ciudadano responda o la CDMB cancele la devolución.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }
  if (await tramiteCerrado(id)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });

  const e = await db.expediente.findUnique({
    where: { id },
    select: {
      estado: true,
      fechaCierre: true,
      codigoSolicitudPublica: true,
      tramiteTipoId: true,
      requerimientosCorreccion: { where: { estado: "PENDIENTE" }, select: { id: true } },
    },
  });
  if (!e) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  if (!e.codigoSolicitudPublica) return NextResponse.json({ error: "Solo las solicitudes radicadas en línea se devuelven por aquí." }, { status: 400 });
  if (tramiteFinalizado(e)) return NextResponse.json({ error: "El trámite ya terminó." }, { status: 409 });
  if (e.requerimientosCorreccion.length > 0) return NextResponse.json({ error: "Ya hay una devolución pendiente de respuesta." }, { status: 409 });

  const body = await req.json().catch(() => null);
  const ahora = new Date();
  const plazoHasta = interpretarPlazo(body?.plazoHasta, ahora);
  if (!plazoHasta) return NextResponse.json({ error: "Indique un plazo futuro de máximo tres meses." }, { status: 400 });
  const validacion = validarItems(body?.items);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const mensaje = typeof body?.mensaje === "string" ? body.mensaje.trim().slice(0, 3000) : "";

  // Los documentos y requisitos deben ser de este expediente y de este trámite.
  const docIds = validacion.items.flatMap((i) => (i.documentoId ? [i.documentoId] : []));
  const reqIds = validacion.items.flatMap((i) => (i.requisitoId ? [i.requisitoId] : []));
  const [docs, reqs] = await Promise.all([
    db.expedienteDocumento.findMany({ where: { id: { in: docIds }, expedienteId: id }, select: { id: true, nombre: true, requisitoId: true, requisito: { select: { nombre: true } } } }),
    db.documentoRequeridoDefinicion.findMany({ where: { id: { in: reqIds }, tramiteTipoId: e.tramiteTipoId }, select: { id: true, nombre: true } }),
  ]);
  if (docs.length !== docIds.length || reqs.length !== reqIds.length) {
    return NextResponse.json({ error: "Uno de los documentos no corresponde a este expediente. Recargue la página." }, { status: 400 });
  }
  const docPorId = new Map(docs.map((d) => [d.id, d]));
  const reqPorId = new Map(reqs.map((r) => [r.id, r]));
  const items = validacion.items.map((i) => {
    const d = i.documentoId ? docPorId.get(i.documentoId) : undefined;
    const r = i.requisitoId ? reqPorId.get(i.requisitoId) : undefined;
    return {
      documentoId: d?.id ?? null,
      requisitoId: d?.requisitoId ?? r?.id ?? null,
      titulo: d ? d.requisito?.nombre ?? d.nombre : r?.nombre ?? i.titulo ?? "Documento",
      motivo: i.motivo,
    };
  });

  const creado = await db.$transaction(async (tx) => {
    const marcado = await tx.expediente.updateMany({
      where: { id, estado: e.estado },
      data: { estado: "INFORMACION_ADICIONAL_REQUERIDA", fechaUltimoMovimiento: ahora },
    });
    if (marcado.count !== 1) throw new Error("CAMBIO_CONCURRENTE");
    const r = await tx.requerimientoCorreccion.create({
      data: { expedienteId: id, mensaje, plazoHasta, estadoAnterior: e.estado, creadoPorId: session.userId, items: { create: items } },
      select: { id: true },
    });
    for (const i of items) {
      if (!i.documentoId) continue;
      await tx.expedienteDocumento.update({
        where: { id: i.documentoId },
        data: { estadoValidacion: "RECHAZADO", validadoPorId: session.userId, validadoEn: ahora, comentarioValidacion: `Devuelto al solicitante: ${i.motivo}` },
      });
    }
    await tx.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "CORRECCION_SOLICITADA",
        descripcion: `${session.nombre} devolvió la solicitud al solicitante para corregir ${items.length} documento${items.length === 1 ? "" : "s"} (${items
          .map((i) => i.titulo)
          .join("; ")}). Plazo: ${formatearFechaLarga(plazoHasta)}.`,
        estadoAnterior: e.estado,
        estadoNuevo: "INFORMACION_ADICIONAL_REQUERIDA",
        usuarioId: session.userId,
      },
    });
    return r;
  }).catch((err) => {
    if (err instanceof Error && err.message === "CAMBIO_CONCURRENTE") return null;
    throw err;
  });
  if (!creado) return NextResponse.json({ error: "El expediente cambió mientras tanto. Recargue la página." }, { status: 409 });

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Expediente",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Devolvió la solicitud ${e.codigoSolicitudPublica} al solicitante para corrección`,
  });
  avisarCorreccionAlCiudadano(creado.id);
  return NextResponse.json({ ok: true, id: creado.id });
}
