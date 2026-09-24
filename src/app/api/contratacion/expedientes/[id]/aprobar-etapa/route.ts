import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAprobarEtapaContratacion } from "@/lib/permisos";
import { aprobarEtapaContratacion, FaltanRequisitosError } from "@/lib/contratacion";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAprobarEtapaContratacion(permisos)) {
    return NextResponse.json({ error: "Solo el Jefe de Contratación puede aprobar el paso de etapa." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    await aprobarEtapaContratacion(id, session.userId, typeof body?.comentario === "string" ? body.comentario : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FaltanRequisitosError) {
      return NextResponse.json({ error: err.message, faltantes: err.faltantes }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo aprobar la etapa." }, { status: 400 });
  }
}
