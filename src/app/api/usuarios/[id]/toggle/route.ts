import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede hacer esto." }, { status: 403 });
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const nuevoEstado = !usuario.activo;
  await db.usuario.update({ where: { id }, data: { activo: nuevoEstado } });

  await registrarAuditoria({
    tipo: nuevoEstado ? "USUARIO_ACTIVADO" : "USUARIO_DESACTIVADO",
    descripcion: `${session.nombre} ${nuevoEstado ? "activó" : "desactivó"} a "${usuario.nombre}" (${usuario.email}).`,
    usuarioId: session.userId,
  });

  return NextResponse.redirect(new URL("/usuarios", req.url), { status: 303 });
}
