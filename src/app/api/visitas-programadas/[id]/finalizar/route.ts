import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarExpediente, puedePlanearVisitas } from "@/lib/permisos";
import { etiquetaConcepto } from "@/lib/concepto-tecnico";
import { equipoDeVisita } from "@/lib/concepto-visita-db";
import { firmantesDeParticipantes } from "@/lib/participantes-visita";
import { asignarFirmantes } from "@/lib/solicitudes-firma";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { deleteDocumento } from "@/lib/storage";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    select: {
      profesionalId: true,
      expedienteId: true,
      visitaTecnica: { select: { id: true, conceptoNumero: true, conceptoFecha: true, formatoVersionId: true, pasoNumero: true, finalizadaEn: true } },
    },
  });
  const vt = visita?.visitaTecnica;
  if (!visita || !vt) return NextResponse.json({ error: "La visita no tiene hoja registrada." }, { status: 404 });
  if (!puedePlanearVisitas(permisos) || !(await puedeEditarExpediente(session.userId, visita.expedienteId))) {
    return NextResponse.json({ error: "Solo el coordinador, el subdirector o un administrador pueden dar el concepto por terminado." }, { status: 403 });
  }
  if (await tramiteCerrado(visita.expedienteId)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });
  if (!vt.formatoVersionId) return NextResponse.json({ error: "La visita no se diligenció con un formato." }, { status: 409 });
  if (!vt.conceptoNumero) return NextResponse.json({ error: "Asigne primero el número del concepto técnico." }, { status: 409 });
  if (vt.finalizadaEn) return NextResponse.json({ error: "El concepto ya fue finalizado." }, { status: 409 });

  const body = (await req.json().catch(() => null)) as { path?: unknown; tamanoBytes?: unknown; hashSha256?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const tamanoBytes = Number(body?.tamanoBytes);
  if (!path || !path.startsWith(`expedientes/${visita.expedienteId}/`) || !Number.isFinite(tamanoBytes) || tamanoBytes <= 0) {
    return NextResponse.json({ error: "No se recibió el PDF del concepto." }, { status: 400 });
  }

  const { lista, contratistas } = await equipoDeVisita(id, visita.profesionalId);
  const firmantes = firmantesDeParticipantes(lista, contratistas);
  const etiqueta = etiquetaConcepto(vt.conceptoNumero, vt.conceptoFecha);
  const ahora = new Date();

  const documento = await db.expedienteDocumento.create({
    data: {
      expedienteId: visita.expedienteId,
      pasoNumero: vt.pasoNumero,
      nombre: `Concepto técnico ${vt.conceptoNumero}.pdf`,
      descripcion: `Concepto técnico ${etiqueta} (visita técnica)`,
      storagePath: path,
      mimeType: "application/pdf",
      tamanoBytes,
      hashSha256: typeof body?.hashSha256 === "string" ? body.hashSha256 : null,
      requiereFirma: true,
      subidoPorId: session.userId,
    },
    select: { id: true, nombre: true },
  });

  const reservado = await db.visitaTecnica.updateMany({
    where: { id: vt.id, finalizadaEn: null },
    data: { finalizadaEn: ahora, finalizadaPorId: session.userId, documentoConceptoId: documento.id },
  });
  if (reservado.count === 0) {
    await db.expedienteDocumento.delete({ where: { id: documento.id } });
    await deleteDocumento(path).catch(() => {});
    return NextResponse.json({ error: "El concepto ya fue finalizado en otra sesión." }, { status: 409 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await asignarFirmantes({ tipo: "documentoExpediente", id: documento.id }, session.userId, firmantes, ip, userAgent);
  } catch (e) {
    await db.visitaTecnica.update({ where: { id: vt.id }, data: { finalizadaEn: null, finalizadaPorId: null, documentoConceptoId: null } });
    await db.solicitudFirma.deleteMany({ where: { documentoExpedienteId: documento.id } });
    await db.expedienteDocumento.delete({ where: { id: documento.id } });
    await deleteDocumento(path).catch(() => {});
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudieron asignar los firmantes." }, { status: 400 });
  }

  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumento",
    entidadId: documento.id,
    accion: "CREA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Se generó "${documento.nombre}" al finalizar la visita técnica`,
  });
  await db.$transaction([
    db.expedienteEvento.create({
      data: {
        expedienteId: visita.expedienteId,
        tipo: "DOCUMENTO_SUBIDO",
        pasoNumero: vt.pasoNumero,
        descripcion: `${session.nombre} dio por terminado el concepto técnico ${etiqueta} y lo envió a firma de ${firmantes.length} persona${firmantes.length === 1 ? "" : "s"}.`,
        usuarioId: session.userId,
      },
    }),
    db.expediente.update({ where: { id: visita.expedienteId }, data: { fechaUltimoMovimiento: ahora } }),
  ]);
  return NextResponse.json({ ok: true, documentoId: documento.id });
}
