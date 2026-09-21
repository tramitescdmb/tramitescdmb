import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

/** Registra la aceptación del aviso de tratamiento de datos del primer ingreso — cualquier
 * usuario autenticado (Directorio Activo o correo/contraseña) puede aceptarlo por sí mismo. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await db.usuario.update({
    where: { id: session.userId },
    data: { terminosAceptadosEn: new Date() },
  });

  return NextResponse.json({ ok: true });
}
