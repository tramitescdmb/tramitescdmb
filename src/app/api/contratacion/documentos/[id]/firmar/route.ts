import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeFirmarDocumentoContrato } from "@/lib/permisos";
import { firmarDocumentoContrato } from "@/lib/contratacion";

/** Revisa y aprueba un documento marcado "requiere firma": estampa la firma electrónica
 * (hash + identidad + timestamp) — Jefe de Contratación o Supervisor/Interventor asignado. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { expedienteId: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (!puedeFirmarDocumentoContrato(permisos, { id: doc.expedienteId })) {
    return NextResponse.json({ error: "No tiene permiso para firmar documentos de este expediente." }, { status: 403 });
  }

  try {
    await firmarDocumentoContrato(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo firmar el documento." }, { status: 400 });
  }
}
