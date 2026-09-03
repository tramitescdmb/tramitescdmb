import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/storage";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "VITAL_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a VITAL." }, { status: 403 });
  }

  const documento = await db.solicitudVitalDocumento.findUnique({ where: { id } });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const url = await getSignedDownloadUrl(documento.storagePath);
  return NextResponse.redirect(url);
}
