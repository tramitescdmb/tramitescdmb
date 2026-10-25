import { NextRequest, NextResponse } from "next/server";
import { sesionEditorFormatos } from "@/lib/formatos-visita-api";
import { configurarConsecutivoConcepto } from "@/lib/concepto-tecnico";

export async function PUT(req: NextRequest) {
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const anio = Number(body?.anio);
  const siguiente = Number(body?.siguiente);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100 || !Number.isInteger(siguiente) || siguiente < 1 || siguiente > 99_999) {
    return NextResponse.json({ error: "Indique un año y un número siguiente válidos." }, { status: 400 });
  }
  try {
    await configurarConsecutivoConcepto(anio, siguiente);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar el consecutivo." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
