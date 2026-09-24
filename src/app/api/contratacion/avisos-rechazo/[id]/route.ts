import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const aviso = await db.avisoRechazoDocumento.findUnique({ where: { id }, select: { subidoPorId: true } });
  if (!aviso) return NextResponse.json({ error: "El aviso no existe (puede que ya se haya borrado)." }, { status: 404 });
  if (aviso.subidoPorId !== session.userId && !puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para descartar este aviso." }, { status: 403 });
  }

  await db.avisoRechazoDocumento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
