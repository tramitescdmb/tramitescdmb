import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const documento = await db.expedienteDocumento.findUnique({
    where: { id },
    include: { expediente: { select: { tramiteTipoId: true } } },
  });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederTramite(permisos, documento.expediente.tramiteTipoId)) {
    return NextResponse.json({ error: "Su rol de acceso no le permite ver este trámite." }, { status: 403 });
  }

  const url = await getSignedDownloadUrl(documento.storagePath);
  return NextResponse.redirect(url);
}
