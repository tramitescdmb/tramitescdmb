import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  await db.notificacion.updateMany({ where: { usuarioId: session.userId, leidaEn: null }, data: { leidaEn: new Date() } });
  return NextResponse.redirect(new URL("/planeador/buzon", req.url), { status: 303 });
}
