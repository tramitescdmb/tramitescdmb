import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesionEditorFormatos } from "@/lib/formatos-visita-api";
import { validarEstructura } from "@/lib/formato-visita";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const borrador = await db.formatoVisitaVersion.findFirst({ where: { formatoId: id, estado: "BORRADOR" } });
  if (!borrador) return NextResponse.json({ error: "No hay cambios pendientes por publicar." }, { status: 409 });
  const validada = validarEstructura(borrador.estructura);
  if ("error" in validada) return NextResponse.json({ error: validada.error }, { status: 400 });
  if (validada.estructura.secciones.every((sec) => sec.campos.length === 0)) {
    return NextResponse.json({ error: "El formato no tiene campos." }, { status: 400 });
  }

  await db.$transaction([
    db.formatoVisitaVersion.updateMany({ where: { formatoId: id, estado: "PUBLICADA" }, data: { estado: "REEMPLAZADA" } }),
    db.formatoVisitaVersion.update({ where: { id: borrador.id }, data: { estado: "PUBLICADA", publicadaEn: new Date(), publicadaPorId: s.userId } }),
    db.formatoVisita.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true, numero: borrador.numero });
}
