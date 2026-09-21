import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarPeriodosInforme } from "@/lib/permisos";
import { registrarEventoContratacion } from "@/lib/contratacion";

async function cargar(id: string, periodoId: string, userId: string) {
  const permisos = await obtenerPermisosUsuario(userId);
  const periodo = await db.periodoInformeEventual.findFirst({
    where: { id: periodoId, expedienteId: id },
    select: { id: true, nombre: true, expediente: { select: { id: true, contratistaId: true, cerrado: true } }, _count: { select: { documentos: true } } },
  });
  if (!periodo) return { error: NextResponse.json({ error: "El espacio no existe." }, { status: 404 }) };
  if (!puedeGestionarPeriodosInforme(permisos, periodo.expediente)) {
    return { error: NextResponse.json({ error: "No tiene permiso para modificar los espacios de informe de este expediente." }, { status: 403 }) };
  }
  if (periodo.expediente.cerrado) return { error: NextResponse.json({ error: "Este expediente está cerrado." }, { status: 409 }) };
  return { periodo };
}

/** Renombra un espacio eventual. Los documentos ya cargados conservan el nombre con el que se guardaron. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; periodoId: string }> }) {
  const { id, periodoId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const r = await cargar(id, periodoId, session.userId);
  if (r.error) return r.error;

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre || "").trim();
  if (!nombre) return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
  if (nombre.length > 120) return NextResponse.json({ error: "El nombre no puede superar los 120 caracteres." }, { status: 400 });

  await db.periodoInformeEventual.update({ where: { id: periodoId }, data: { nombre } });
  await registrarEventoContratacion(id, "PERIODO_INFORME_RENOMBRADO", `Se renombró el espacio de informe «${r.periodo.nombre}» a «${nombre}».`, session.userId);
  return NextResponse.json({ ok: true });
}

/** Quita un espacio eventual — solo si está vacío, para no dejar documentos sin periodo. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; periodoId: string }> }) {
  const { id, periodoId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const r = await cargar(id, periodoId, session.userId);
  if (r.error) return r.error;
  if (r.periodo._count.documentos > 0) {
    return NextResponse.json({ error: "El espacio ya tiene un documento cargado: elimine primero el documento." }, { status: 409 });
  }

  await db.periodoInformeEventual.delete({ where: { id: periodoId } });
  await registrarEventoContratacion(id, "PERIODO_INFORME_ELIMINADO", `Se eliminó el espacio de informe «${r.periodo.nombre}».`, session.userId);
  return NextResponse.json({ ok: true });
}
