import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sesionEditorFormatos, textoLimpio } from "@/lib/formatos-visita-api";
import { sembrarFormatosBase } from "@/lib/formatos-visita-db";

export async function POST(req: NextRequest) {
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  if (body.accion === "sembrar") {
    const r = await sembrarFormatosBase(s.userId);
    return NextResponse.json(r);
  }

  const codigo = textoLimpio(body.codigo, 40).toUpperCase();
  const nombre = textoLimpio(body.nombre, 150);
  const titulo = textoLimpio(body.titulo, 200).toUpperCase();
  if (!codigo || !nombre || !titulo) return NextResponse.json({ error: "Indique el código, el nombre y el título del formato." }, { status: 400 });
  if (await db.formatoVisita.findUnique({ where: { codigo } })) {
    return NextResponse.json({ error: `Ya existe un formato con el código ${codigo}.` }, { status: 409 });
  }

  const copiarDe = typeof body.copiarDe === "string" ? body.copiarDe : null;
  let estructura: Prisma.InputJsonValue = { secciones: [{ id: "datos_generales", titulo: "Datos generales", campos: [] }] };
  if (copiarDe) {
    const origen = await db.formatoVisitaVersion.findFirst({ where: { formatoId: copiarDe }, orderBy: { numero: "desc" } });
    if (origen) estructura = origen.estructura as Prisma.InputJsonValue;
  }

  const formato = await db.formatoVisita.create({
    data: {
      codigo,
      nombre,
      titulo,
      creadoPorId: s.userId,
      versiones: { create: { numero: 1, estado: "BORRADOR", estructura, creadoPorId: s.userId } },
    },
  });
  return NextResponse.json({ id: formato.id });
}
