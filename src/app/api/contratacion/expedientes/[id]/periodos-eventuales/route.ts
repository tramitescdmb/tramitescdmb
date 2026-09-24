import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarPeriodosInforme } from "@/lib/permisos";
import { registrarEventoContratacion } from "@/lib/contratacion";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({ where: { id }, select: { id: true, contratistaId: true, cerrado: true } });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (!puedeGestionarPeriodosInforme(permisos, expediente)) {
    return NextResponse.json({ error: "No tiene permiso para crear espacios de informe en este expediente." }, { status: 403 });
  }
  if (expediente.cerrado) return NextResponse.json({ error: "Este expediente está cerrado." }, { status: 409 });

  const body = await req.json().catch(() => null);
  const requisitoId = String(body?.requisitoId || "").trim();
  const nombre = String(body?.nombre || "").trim();
  if (!requisitoId) return NextResponse.json({ error: "Falta indicar a qué requisito pertenece el espacio." }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: "Escriba el nombre del espacio (ej. «Informe extraordinario por suspensión»)." }, { status: 400 });
  if (nombre.length > 120) return NextResponse.json({ error: "El nombre no puede superar los 120 caracteres." }, { status: 400 });

  const requisito = await db.requisitoDocumentoContratacion.findUnique({ where: { id: requisitoId }, select: { id: true } });
  if (!requisito) return NextResponse.json({ error: "El requisito indicado no existe." }, { status: 400 });

  const duplicado = await db.periodoInformeEventual.findFirst({
    where: { expedienteId: id, requisitoId, nombre: { equals: nombre, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicado) return NextResponse.json({ error: "Ya existe un espacio con ese nombre para este requisito." }, { status: 409 });

  const creado = await db.periodoInformeEventual.create({ data: { expedienteId: id, requisitoId, nombre, creadoPorId: session.userId } });
  await registrarEventoContratacion(id, "PERIODO_INFORME_CREADO", `Se creó el espacio de informe «${nombre}».`, session.userId);
  return NextResponse.json({ id: creado.id }, { status: 201 });
}
