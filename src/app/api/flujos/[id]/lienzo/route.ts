import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { guardarLienzoFlujo, type LienzoNodo, type LienzoTransicion } from "@/lib/flujos";
import { moduloDeAmbito, puedeAdministrarFlujosModulo, TIPOS_PASO_DE_MODULO } from "@/lib/flujos-modulos";
import { db } from "@/lib/db";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });
  const flujo = await db.flujoTrabajo.findUnique({ where: { id }, select: { ambito: true } });
  if (!flujo) return NextResponse.json({ error: "El flujo no existe." }, { status: 404 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, moduloDeAmbito(flujo.ambito))) {
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
  const permitidos: string[] = TIPOS_PASO_DE_MODULO[moduloDeAmbito(flujo.ambito)];
  if (nodos.some((n) => !permitidos.includes(String(n.tipo)))) {
    return NextResponse.json({ error: "Este módulo no admite ese tipo de paso." }, { status: 400 });
  }

  try {
    await guardarLienzoFlujo(id, { nodos, transiciones });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar el diagrama." }, { status: 400 });
  }
}
