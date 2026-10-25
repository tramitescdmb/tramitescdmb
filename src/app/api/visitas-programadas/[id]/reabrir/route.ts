import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarExpediente, puedePlanearVisitas } from "@/lib/permisos";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    select: {
      expedienteId: true,
      visitaTecnica: {
        select: {
          id: true,
          pasoNumero: true,
          finalizadaEn: true,
          documentoConcepto: { select: { id: true, nombre: true, solicitudesFirma: { select: { id: true, estado: true, rol: true } } } },
        },
      },
    },
  });
  const vt = visita?.visitaTecnica;
  if (!visita || !vt) return NextResponse.json({ error: "La visita no tiene hoja registrada." }, { status: 404 });
  if (!puedePlanearVisitas(permisos) || !(await puedeEditarExpediente(session.userId, visita.expedienteId))) {
    return NextResponse.json({ error: "Solo el coordinador, el subdirector o un administrador pueden reabrir el concepto." }, { status: 403 });
  }
  if (await tramiteCerrado(visita.expedienteId)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });
  const doc = vt.documentoConcepto;
  if (!vt.finalizadaEn || !doc) return NextResponse.json({ error: "El concepto no está en firma." }, { status: 409 });
  const firmas = doc.solicitudesFirma.filter((s) => s.rol !== "LECTURA");
  if (firmas.length > 0 && firmas.every((s) => s.estado === "COMPLETADA")) {
    return NextResponse.json({ error: "El concepto ya fue firmado por todos; no se puede reabrir." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { motivo?: unknown } | null;
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim().slice(0, 500) : "";
  if (!motivo) return NextResponse.json({ error: "Indique por qué se reabre el concepto." }, { status: 400 });

  await db.$transaction([
    db.solicitudFirma.deleteMany({ where: { documentoExpedienteId: doc.id, estado: "PENDIENTE" } }),
    db.expedienteDocumento.update({
      where: { id: doc.id },
      data: { nombre: doc.nombre.replace(/\.pdf$/i, " (versión reemplazada).pdf"), requiereFirma: false, estadoValidacion: "RECHAZADO" },
    }),
    db.visitaTecnica.update({ where: { id: vt.id }, data: { finalizadaEn: null, finalizadaPorId: null, documentoConceptoId: null } }),
    db.expedienteEvento.create({
      data: {
        expedienteId: visita.expedienteId,
        tipo: "VISITA_REGISTRADA",
        pasoNumero: vt.pasoNumero,
        descripcion: `${session.nombre} reabrió el concepto técnico para corrección: ${motivo} La versión enviada a firma queda en el expediente como reemplazada.`,
        usuarioId: session.userId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
