import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Descarga (URL firmada) de un documento de correspondencia — con auditoría de LECTURA. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a correspondencia." }, { status: 403 });
  }

  const doc = await db.comunicacionDocumento.findUnique({
    where: { id },
    select: { storagePath: true, nombre: true, comunicacionId: true },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ComunicacionDocumento",
    entidadId: id,
    accion: "LEE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Descargó/abrió el documento "${doc.nombre}" de la comunicación ${doc.comunicacionId}`,
  });

  const url = await getSignedDownloadUrl(doc.storagePath);
  return NextResponse.redirect(url);
}
