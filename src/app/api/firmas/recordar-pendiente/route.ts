import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { recordarFirmaPendiente } from "@/lib/firmas-en-espera";

/** Quien solicitó la firma o ya firmó el documento le recuerda al firmante pendiente que falta su firma. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.solicitudId !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    return NextResponse.json(await recordarFirmaPendiente(body.solicitudId, session.userId, session.rol === "ADMIN"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo enviar el recordatorio." }, { status: 400 });
  }
}
