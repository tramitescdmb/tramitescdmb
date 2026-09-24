import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { completarSolicitudFirma } from "@/lib/solicitudes-firma";
import { datosPeticion } from "@/lib/auditoria-doc";

/** Completa (firma/da visto bueno) una solicitud de un documento de trámites asignada al usuario
 * que llama esta ruta — captura IP/user-agent reales para la ficha técnica de firma. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await completarSolicitudFirma(id, session.userId, ip, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo completar la solicitud." }, { status: 400 });
  }
}
