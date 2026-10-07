import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const n = await db.notificacion.findUnique({ where: { id }, select: { usuarioId: true, enlace: true, leidaEn: true } });
  if (!n || n.usuarioId !== session.userId) return NextResponse.redirect(new URL("/planeador/buzon", req.url), { status: 303 });
  if (!n.leidaEn) await db.notificacion.update({ where: { id }, data: { leidaEn: new Date() } });
  return NextResponse.redirect(new URL(n.enlace.startsWith("/") ? n.enlace : "/planeador/buzon", req.url), { status: 303 });
}
