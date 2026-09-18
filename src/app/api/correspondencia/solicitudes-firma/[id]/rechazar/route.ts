import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { rechazarSolicitudFirma } from "@/lib/solicitudes-firma";

/** Rechaza una solicitud de firma de correspondencia asignada al usuario que llama esta ruta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const comentario = typeof body?.comentario === "string" ? body.comentario : "";

  try {
    await rechazarSolicitudFirma(id, session.userId, comentario);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo rechazar." }, { status: 400 });
  }
}
