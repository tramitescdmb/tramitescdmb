import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sincronizarFlujoPorFirmas } from "@/lib/flujos";
import { verificarSesion as getSession } from "@/lib/permisos";
import { completarSolicitudFirma } from "@/lib/solicitudes-firma";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await completarSolicitudFirma(id, session.userId, ip, userAgent);
    const sol = await db.solicitudFirma.findUnique({ where: { id }, select: { comunicacionId: true } });
    if (sol?.comunicacionId) await sincronizarFlujoPorFirmas(sol.comunicacionId, session.userId).catch((e) => console.error("sincronizarFlujoPorFirmas falló:", e));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo completar la solicitud." }, { status: 400 });
  }
}
