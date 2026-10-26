import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { devolverConcepto, enviarConceptoARevision } from "@/lib/revision-concepto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const planificador = puedePlanearVisitas(permisos);
  const body = (await req.json().catch(() => null)) as { accion?: unknown; comentario?: unknown } | null;
  const comentario = typeof body?.comentario === "string" ? body.comentario.trim().slice(0, 2000) : "";
  const usuario = { id: session.userId, nombre: session.nombre };
  try {
    if (body?.accion === "enviar") {
      await enviarConceptoARevision(id, usuario, planificador, comentario || null);
    } else if (body?.accion === "devolver") {
      if (!planificador) return NextResponse.json({ error: "Solo quien planea las visitas puede devolver el concepto." }, { status: 403 });
      await devolverConcepto(id, usuario, comentario);
    } else {
      return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo completar la acción." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
