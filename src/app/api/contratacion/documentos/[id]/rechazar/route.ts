import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeFirmarDocumentoContrato } from "@/lib/permisos";
import { rechazarDocumentoContrato } from "@/lib/contratacion";

/** Rechaza un documento en revisión (mismo gate que firmar: Jefe o Supervisor/Interventor asignado). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { expedienteId: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (!puedeFirmarDocumentoContrato(permisos, { id: doc.expedienteId })) {
    return NextResponse.json({ error: "No tiene permiso para revisar documentos de este expediente." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const comentario = typeof body?.comentario === "string" ? body.comentario : "";

  try {
    await rechazarDocumentoContrato(id, session.userId, comentario);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo rechazar el documento." }, { status: 400 });
  }
}
