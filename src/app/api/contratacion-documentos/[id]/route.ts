import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerDocumentoContrato, tieneSolicitudFirmaEnExpedienteContractual, tieneFirmaOSolicitudEnDocumentoContrato } from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { getSignedDownloadUrl } from "@/lib/storage";
import { accesoDesdeArchivoSgdea } from "@/lib/acceso-archivo-modulos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: {
      storagePath: true,
      nombre: true,
      etapa: true,
      expediente: { select: { id: true, contratistaId: true, dependenciaSolicitanteId: true, etapaActual: true, eliminado: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  const permitido =
    !doc.expediente.eliminado &&
    (puedeVerDocumentoContrato(permisos, doc.expediente, doc.etapa) ||
      (await tieneSolicitudFirmaEnExpedienteContractual(session.userId, doc.expediente.id)) ||
      (await tieneFirmaOSolicitudEnDocumentoContrato(session.userId, id)) ||
      (!(permisos.contratacion === "CONTRATISTA" && doc.etapa === "PRECONTRACTUAL") &&
        (await accesoDesdeArchivoSgdea({
          permisos,
          origen: "GECON",
          origenId: doc.expediente.id,
          usuarioId: session.userId,
          documento: doc.nombre,
          headers: req.headers,
        }))));
  if (!permitido) {
    await registrarAccesoDenegadoAccion("descargar un documento de contratación", id, session, req.headers);
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }

  const url = await getSignedDownloadUrl(doc.storagePath);
  return NextResponse.redirect(url);
}
