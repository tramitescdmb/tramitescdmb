import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { incrementarUso } from "@/lib/plantillas";

/**
 * Marca una plantilla como usada (+1 al contador). Se llama sin bloquear al
 * cargar la plantilla en un formulario — es solo estadística de uso.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) return NextResponse.json({ ok: false }, { status: 403 });
  await incrementarUso(id);
  return NextResponse.json({ ok: true });
}
