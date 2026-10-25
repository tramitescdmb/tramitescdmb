import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sesionEditorFormatos, textoLimpio } from "@/lib/formatos-visita-api";
import { validarEstructura } from "@/lib/formato-visita";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const validada = validarEstructura(body.estructura);
  if ("error" in validada) return NextResponse.json({ error: validada.error }, { status: 400 });
  const estructura = validada.estructura as unknown as Prisma.InputJsonValue;
  const nota = textoLimpio(body.nota, 1_000) || null;

  const versiones = await db.formatoVisitaVersion.findMany({ where: { formatoId: id }, select: { id: true, numero: true, estado: true }, orderBy: { numero: "desc" } });
  if (!(await db.formatoVisita.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: "Formato no encontrado." }, { status: 404 });
  }
  const borrador = versiones.find((v) => v.estado === "BORRADOR");
  if (borrador) {
    await db.formatoVisitaVersion.update({ where: { id: borrador.id }, data: { estructura, nota, creadoPorId: s.userId } });
    return NextResponse.json({ id: borrador.id, numero: borrador.numero });
  }
  const numero = (versiones[0]?.numero ?? 0) + 1;
  const creada = await db.formatoVisitaVersion.create({ data: { formatoId: id, numero, estado: "BORRADOR", estructura, nota, creadoPorId: s.userId } });
  return NextResponse.json({ id: creada.id, numero });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const borrador = await db.formatoVisitaVersion.findFirst({ where: { formatoId: id, estado: "BORRADOR" } });
  if (!borrador) return NextResponse.json({ error: "No hay borrador para descartar." }, { status: 404 });
  const publicadas = await db.formatoVisitaVersion.count({ where: { formatoId: id, estado: { not: "BORRADOR" } } });
  if (publicadas === 0) return NextResponse.json({ error: "El formato aún no tiene versión publicada; el borrador no se puede descartar." }, { status: 409 });
  await db.formatoVisitaVersion.delete({ where: { id: borrador.id } });
  return NextResponse.json({ ok: true });
}
