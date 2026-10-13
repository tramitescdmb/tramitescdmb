import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas, puedeRegistrarModificacionContrato, type PermisosUsuario } from "@/lib/permisos";

export async function autorizarGestionContrato(
  id: string,
  nivel: "registrar" | "aprobar"
): Promise<{ ok: true; userId: string; permisos: PermisosUsuario } | { ok: false; respuesta: NextResponse }> {
  const session = await getSession();
  if (!session) return { ok: false, respuesta: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const [permisos, expediente] = await Promise.all([
    obtenerPermisosUsuario(session.userId),
    db.expedienteContractual.findFirst({ where: { id, eliminado: false }, select: { id: true, contratistaId: true, cerrado: true } }),
  ]);
  if (!expediente) return { ok: false, respuesta: NextResponse.json({ error: "El expediente no existe." }, { status: 404 }) };
  const permitido = nivel === "aprobar" ? !expediente.cerrado && puedeGestionarContratistas(permisos) : puedeRegistrarModificacionContrato(permisos, expediente);
  if (!permitido) {
    const mensaje = nivel === "aprobar" ? "Solo el administrador o el jefe de contratación pueden hacerlo." : "No tiene permiso para gestionar este contrato.";
    return { ok: false, respuesta: NextResponse.json({ error: mensaje }, { status: 403 }) };
  }
  return { ok: true, userId: session.userId, permisos };
}

export function fechaDe(v: unknown): Date | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
}
