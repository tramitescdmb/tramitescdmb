import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeValidarDocumentoContrato, puedeEditarSinTrazaDocumentoContrato } from "@/lib/permisos";
import { validarDocumentoContrato } from "@/lib/contratacion";
import { datosPeticion } from "@/lib/auditoria-doc";
import { MENSAJE_EXPEDIENTE_CERRADO } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { id: true, expedienteId: true, expediente: { select: { cerrado: true } } } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (doc.expediente.cerrado) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });
  if (!puedeValidarDocumentoContrato(permisos, { id: doc.expedienteId })) {
    return NextResponse.json({ error: "No tiene permiso para validar documentos." }, { status: 403 });
  }

  try {
    await validarDocumentoContrato(id, session.userId, {
      sinTraza: puedeEditarSinTrazaDocumentoContrato(permisos),
      ...datosPeticion(req.headers),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo validar el documento." }, { status: 400 });
  }
}
