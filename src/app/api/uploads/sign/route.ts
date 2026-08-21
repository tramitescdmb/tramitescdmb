import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const expedienteId = body?.expedienteId ? String(body.expedienteId) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";

  if (!expedienteId || !fileName) {
    return NextResponse.json({ error: "Faltan expedienteId o fileName." }, { status: 400 });
  }

  const path = buildStoragePath(expedienteId, fileName);
  const { token } = await crearUrlSubidaFirmada(path);

  return NextResponse.json({ path, token });
}
