import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarExpedienteCompleto } from "@/lib/permisos";
import { reclasificarTrdContrato } from "@/lib/contratacion";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarExpedienteCompleto(permisos, { id })) {
    return NextResponse.json({ error: "No tiene permiso para reclasificar este expediente." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const subserieId = typeof body.subserieId === "string" ? body.subserieId : "";
  const motivo = typeof body.motivo === "string" ? body.motivo : "";
  if (!subserieId) return NextResponse.json({ error: "Elija la subserie." }, { status: 400 });
  try {
    const nueva = await reclasificarTrdContrato(id, subserieId, motivo, session.userId);
    return NextResponse.json({ ok: true, etiqueta: nueva.etiqueta });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo reclasificar." }, { status: 400 });
  }
}
