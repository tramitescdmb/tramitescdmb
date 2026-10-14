import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { solicitarVinculacionContratista } from "@/lib/contratacion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    return NextResponse.json(await solicitarVinculacionContratista(session.userId, String(body?.documento ?? "")), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar la solicitud." }, { status: 400 });
  }
}
