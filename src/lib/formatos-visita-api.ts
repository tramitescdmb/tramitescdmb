import { NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarFormatosVisita } from "@/lib/permisos";

export async function sesionEditorFormatos(): Promise<{ userId: string; nombre: string } | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarFormatosVisita(permisos)) {
    return NextResponse.json({ error: "Solo el administrador y el subdirector pueden modificar los formatos de visita." }, { status: 403 });
  }
  return { userId: session.userId, nombre: session.nombre };
}

export function textoLimpio(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
