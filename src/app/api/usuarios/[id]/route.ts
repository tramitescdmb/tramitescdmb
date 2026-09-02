import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Editar cargo/rol/rol de acceso de un usuario YA EXISTENTE — antes no existía
 * (solo se podía crear o activar/desactivar), lo que dejaba sin forma de
 * configurar a un funcionario que ya entró por Directorio Activo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede hacer esto." }, { status: 403 });
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const rol = body.rol === "ADMIN" || body.rol === "FUNCIONARIO" ? body.rol : usuario.rol;
  const cargoId: string | null = body.cargoId === undefined ? usuario.cargoId : body.cargoId || null;
  const rolPermisosId: string | null = body.rolPermisosId === undefined ? usuario.rolPermisosId : body.rolPermisosId || null;

  if (cargoId && !(await db.cargo.findUnique({ where: { id: cargoId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Cargo no encontrado." }, { status: 400 });
  }
  if (rolPermisosId && !(await db.rol.findUnique({ where: { id: rolPermisosId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Rol de acceso no encontrado." }, { status: 400 });
  }

  await db.usuario.update({ where: { id }, data: { rol, cargoId, rolPermisosId } });

  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó a "${usuario.nombre}" (${usuario.email}): rol ${rol}.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
