import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";

/** Descarga (URL firmada) de un documento de un expediente contractual — usado tanto por el enlace
 * "Abrir" como por VistaPreviaDocumento (iframe/img apuntan aquí, que redirige a Supabase). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: { storagePath: true, expediente: { select: { id: true, contratistaId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!puedeVerExpedienteContractual(permisos, doc.expediente)) {
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }

  const url = await getSignedDownloadUrl(doc.storagePath);
  return NextResponse.redirect(url);
}
