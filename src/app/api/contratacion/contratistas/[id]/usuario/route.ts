import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas, esPersonalContratacion } from "@/lib/permisos";
import { crearUsuarioParaContratista } from "@/lib/usuario-temporal";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos) && !esPersonalContratacion(permisos)) {
    return NextResponse.json({ error: "Solo el personal de contratación crea usuarios temporales de contratistas." }, { status: 403 });
  }
  const r = await crearUsuarioParaContratista(id, { id: session.userId, nombre: session.nombre });
  if (!r.ok) return NextResponse.json({ error: r.mensaje }, { status: 400 });
  return NextResponse.json(r);
}
