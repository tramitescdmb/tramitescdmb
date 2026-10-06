import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const foto = await db.visitaTecnicaFoto.findUnique({
    where: { id },
    select: { storagePath: true, visita: { select: { expediente: { select: { tramiteTipoId: true } } } } },
  });
  if (!foto) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederTramite(permisos, foto.visita.expediente.tramiteTipoId)) {
    return NextResponse.json({ error: "Su rol de acceso no le permite ver este trámite." }, { status: 403 });
  }
  return NextResponse.redirect(await getSignedDownloadUrl(foto.storagePath));
}
