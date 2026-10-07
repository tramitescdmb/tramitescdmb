import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerDocumentoContrato, tieneSolicitudFirmaEnExpedienteContractual, tieneFirmaOSolicitudEnDocumentoContrato, esContratistaGecon } from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { descargarDocumento } from "@/lib/storage";
import { estamparFirmaGecon } from "@/lib/pdf-rotulado";
import { servirDerivado, huellaDerivado } from "@/lib/derivados";
import { accesoDesdeArchivoSgdea } from "@/lib/acceso-archivo-modulos";
import { SELECT_FIRMAS_DOCUMENTO_GECON, datosRotuloGecon, firmantesDocumentoGecon, supervisoresDelExpediente } from "@/lib/firmantes-gecon";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: {
      hashSha256: true,
      storagePath: true,
      nombre: true,
      mimeType: true,
      etapa: true,
      expediente: {
        select: {
          id: true,
          numero: true,
          contratistaId: true,
          dependenciaSolicitanteId: true,
          etapaActual: true,
          eliminado: true,
        },
      },
      ...SELECT_FIRMAS_DOCUMENTO_GECON,
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  const permitido =
    !doc.expediente.eliminado &&
    (puedeVerDocumentoContrato(permisos, doc.expediente, doc.etapa) ||
      (await tieneSolicitudFirmaEnExpedienteContractual(session.userId, doc.expediente.id)) ||
      (await tieneFirmaOSolicitudEnDocumentoContrato(session.userId, id)) ||
      (!(esContratistaGecon(permisos) && doc.etapa === "PRECONTRACTUAL") &&
        (await accesoDesdeArchivoSgdea({
          permisos,
          origen: "GECON",
          origenId: doc.expediente.id,
          usuarioId: session.userId,
          documento: doc.nombre,
          headers: req.headers,
        }))));
  if (!permitido) {
    await registrarAccesoDenegadoAccion("descargar el rótulo firmado de un documento de contratación", id, session, req.headers);
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El rótulo solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const datos = datosRotuloGecon({ id, nombre: doc.nombre, hashSha256: doc.hashSha256 }, doc.expediente.numero, base);
  const firmantes = firmantesDocumentoGecon(doc, await supervisoresDelExpediente(doc.expediente.id));

  const slug = doc.nombre.replace(/[^A-Za-z0-9-]/g, "_").slice(0, 60);
  try {
    return await servirDerivado({
      carpeta: `gecon/${id}`,
      huella: huellaDerivado(doc.storagePath, datos, firmantes),
      nombreArchivo: `${slug}-firmado.pdf`,
      contentType: "application/pdf",
      generar: async () => estamparFirmaGecon(await descargarDocumento(doc.storagePath), datos, firmantes),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF con rótulo." },
      { status: 500 },
    );
  }
}
