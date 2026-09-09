import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { guardarLienzoFlujo, puedeAdministrarFlujos, type LienzoNodo, type LienzoTransicion } from "@/lib/flujos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Guarda el diagrama del flujo tal como quedó en el editor visual. Body JSON. Solo administrador de archivo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) {
    await registrarAccesoDenegadoAccion("Editar diagrama de flujo", id, session, await headers());
    return NextResponse.json({ error: "No tiene permiso para administrar flujos de trabajo." }, { status: 403 });
  }

  let body: { nodos?: LienzoNodo[]; transiciones?: LienzoTransicion[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const nodos = Array.isArray(body.nodos) ? body.nodos : [];
  const transiciones = Array.isArray(body.transiciones) ? body.transiciones : [];

  try {
    await guardarLienzoFlujo(id, { nodos, transiciones });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar el diagrama." }, { status: 400 });
  }
}
