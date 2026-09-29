import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeSubirDocumentoContrato } from "@/lib/permisos";
import { marcarCargadoEnSecop } from "@/lib/contratacion";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: { expediente: { select: { id: true, contratistaId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (!puedeSubirDocumentoContrato(permisos, doc.expediente, "PRECONTRACTUAL")) {
    await registrarAccesoDenegadoAccion("marcar un documento precontractual como cargado en SECOP", id, session, req.headers);
    return NextResponse.json({ error: "No tiene permiso para editar este documento." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const cargado = Boolean(body.cargado);

  try {
    await marcarCargadoEnSecop(id, session.userId, cargado);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo actualizar el estado." }, { status: 400 });
  }
}
