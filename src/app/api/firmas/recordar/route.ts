import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { recordarFirmantesAnteriores } from "@/lib/solicitudes-firma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.solicitudId !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    return NextResponse.json(await recordarFirmantesAnteriores(body.solicitudId, session.userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo enviar el aviso." }, { status: 400 });
  }
}
