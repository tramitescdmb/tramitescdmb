import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarEtapasContratacion } from "@/lib/permisos";
import { retrocederEtapaContratacion } from "@/lib/contratacion";

/** Retrocede el expediente a la etapa inmediatamente anterior (corrige un avance hecho por
 * error) — Administrador o Jefe de Contratación, exige motivo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarEtapasContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para retroceder la etapa de este expediente." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const motivo = typeof body?.motivo === "string" ? body.motivo : "";
  try {
    await retrocederEtapaContratacion(id, session.userId, motivo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo retroceder la etapa." }, { status: 400 });
  }
}
