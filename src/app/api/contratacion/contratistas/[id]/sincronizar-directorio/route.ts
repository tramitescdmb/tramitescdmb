import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas, esPersonalContratacion } from "@/lib/permisos";
import { sincronizarContratistaConDominio } from "@/lib/directorio-usuarios";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos) && !esPersonalContratacion(permisos)) {
    return NextResponse.json({ error: "Solo el personal de contratación sincroniza contratistas." }, { status: 403 });
  }
  const r = await sincronizarContratistaConDominio(id);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
