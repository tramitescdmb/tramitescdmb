import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeRegistrarContratistaMinimo } from "@/lib/permisos";
import { resolverSolicitudVinculacion } from "@/lib/contratacion";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeRegistrarContratistaMinimo(await obtenerPermisosUsuario(session.userId))) {
    return NextResponse.json({ error: "No tiene permiso para confirmar vinculaciones." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  try {
    await resolverSolicitudVinculacion(id, body?.aprobar === true, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo resolver la solicitud." }, { status: 400 });
  }
}
