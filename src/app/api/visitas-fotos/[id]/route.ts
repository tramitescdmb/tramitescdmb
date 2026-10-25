import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas, puedeVerExpedienteTramite } from "@/lib/permisos";
import { deleteDocumento, descargarDocumento, getSignedDownloadUrl } from "@/lib/storage";
import { accesoCorreccionConcepto } from "@/lib/concepto-visita-db";

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

async function fotoCorregible(id: string) {
  const session = await getSession();
  if (!session) return { respuesta: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const foto = await db.visitaTecnicaFoto.findUnique({ where: { id }, select: { id: true, storagePath: true, visita: { select: { visitaProgramadaId: true } } } });
  if (!foto?.visita.visitaProgramadaId) return { respuesta: NextResponse.json({ error: "Foto no encontrada" }, { status: 404 }) };
  const permisos = await obtenerPermisosUsuario(session.userId);
  const acceso = await accesoCorreccionConcepto(foto.visita.visitaProgramadaId, session.userId, puedePlanearVisitas(permisos));
  if ("error" in acceso) return { respuesta: NextResponse.json({ error: acceso.error }, { status: acceso.status }) };
  return { foto };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await fotoCorregible(id);
  if ("respuesta" in r) return r.respuesta;
  const body = (await req.json().catch(() => null)) as { pie?: unknown } | null;
  const pie = typeof body?.pie === "string" && body.pie.trim() ? body.pie.trim().slice(0, 200) : null;
  await db.visitaTecnicaFoto.update({ where: { id }, data: { pie } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await fotoCorregible(id);
  if ("respuesta" in r) return r.respuesta;
  await db.visitaTecnicaFoto.delete({ where: { id } });
  await deleteDocumento(r.foto.storagePath).catch(() => {});
  return NextResponse.json({ ok: true });
}
