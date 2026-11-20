import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, puedeEditarExpediente } from "@/lib/permisos";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";
import { estadoTrasRespuesta } from "@/lib/correccion-solicitud";

/** Retira la devolución pendiente (por ejemplo, si se hizo por error). El expediente vuelve a su estado. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }
  if (await tramiteCerrado(id)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });

  const r = await db.requerimientoCorreccion.findFirst({ where: { expedienteId: id, estado: "PENDIENTE" }, select: { id: true, estadoAnterior: true } });
  if (!r) return NextResponse.json({ error: "No hay una devolución pendiente." }, { status: 404 });
  const ahora = new Date();
  const nuevo = estadoTrasRespuesta(r.estadoAnterior);
  const ok = await db.$transaction(async (tx) => {
    const c = await tx.requerimientoCorreccion.updateMany({
      where: { id: r.id, estado: "PENDIENTE" },
      data: { estado: "CANCELADO", canceladoEn: ahora, canceladoPorId: session.userId },
    });
    if (c.count !== 1) return false;
    await tx.expediente.updateMany({ where: { id, estado: "INFORMACION_ADICIONAL_REQUERIDA" }, data: { estado: nuevo, fechaUltimoMovimiento: ahora } });
    await tx.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "CAMBIO_ESTADO",
        descripcion: `${session.nombre} retiró la devolución para corrección.`,
        estadoAnterior: "INFORMACION_ADICIONAL_REQUERIDA",
        estadoNuevo: nuevo,
        usuarioId: session.userId,
      },
    });
    return true;
  });
  if (!ok) return NextResponse.json({ error: "La devolución ya no está pendiente. Recargue la página." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
