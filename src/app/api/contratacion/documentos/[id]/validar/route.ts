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

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: { id: true, etapa: true, expedienteId: true, expediente: { select: { cerrado: true, dependenciaSolicitanteId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (doc.expediente.cerrado) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });
  if (doc.etapa !== "PRECONTRACTUAL") {
    return NextResponse.json({ error: "Solo se validan documentos de la etapa Precontractual; en las demás etapas los documentos se firman." }, { status: 400 });
  }
  if (!puedeValidarDocumentoContrato(permisos, { id: doc.expedienteId, dependenciaSolicitanteId: doc.expediente.dependenciaSolicitanteId }, doc.etapa)) {
    return NextResponse.json({ error: "Validan el personal de contratación asignado, el jefe de contratación o el jefe de la dependencia solicitante." }, { status: 403 });
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
