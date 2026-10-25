import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeVerExpedienteTramite } from "@/lib/permisos";
import { descargarDocumento, getSignedDownloadUrl } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const foto = await db.visitaTecnicaFoto.findUnique({
    where: { id },
    select: { storagePath: true, mimeType: true, visita: { select: { expediente: { select: { id: true, tramiteTipoId: true } } } } },
  });
  if (!foto) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeVerExpedienteTramite(permisos, foto.visita.expediente)) {
    return NextResponse.json({ error: "Su rol de acceso no le permite ver este trámite." }, { status: 403 });
  }
  if (new URL(req.url).searchParams.has("directo")) {
    const bytes = await descargarDocumento(foto.storagePath);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": foto.mimeType, "Cache-Control": "private, max-age=300" } });
  }
  return NextResponse.redirect(await getSignedDownloadUrl(foto.storagePath));
}
