import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeValidarDocumentoTramite } from "@/lib/permisos";
import { validarDocumentoTramite } from "@/lib/tramites-firma";
import { datosPeticion } from "@/lib/auditoria-doc";

/** Validación manual de un documento del checklist de un expediente de trámites. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeValidarDocumentoTramite(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para validar documentos." }, { status: 403 });
  }

  const doc = await db.expedienteDocumento.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });

  try {
    await validarDocumentoTramite(id, session.userId, datosPeticion(req.headers));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo validar el documento." }, { status: 400 });
  }
}
