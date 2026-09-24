import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await db.usuario.update({
    where: { id: session.userId },
    data: { terminosAceptadosEn: new Date() },
  });

  return NextResponse.json({ ok: true });
}
