import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const aviso = await db.avisoRechazoDocumento.findUnique({ where: { id }, select: { subidoPorId: true, comunicacionId: true, documentoArchivoId: true } });
  if (!aviso || (!aviso.comunicacionId && !aviso.documentoArchivoId)) {
    return NextResponse.json({ error: "El aviso no existe (puede que ya se haya borrado)." }, { status: 404 });
  }
  if (aviso.subidoPorId !== session.userId && !puedeAdministrarArchivo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para descartar este aviso." }, { status: 403 });
  }

  await db.avisoRechazoDocumento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
