import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Editar cargo(s)/rol/rol de acceso de un usuario YA EXISTENTE — antes no existía
 * (solo se podía crear o activar/desactivar), lo que dejaba sin forma de
 * configurar a un funcionario que ya entró por Directorio Activo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede hacer esto." }, { status: 403 });
  }

  const usuario = await db.usuario.findUnique({ where: { id }, include: { cargos: true } });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const rol = body.rol === "ADMIN" || body.rol === "FUNCIONARIO" ? body.rol : usuario.rol;
  const cargoIds: string[] | undefined = Array.isArray(body.cargoIds)
    ? body.cargoIds.filter((v: unknown): v is string => typeof v === "string")
    : undefined;
  const rolPermisosId: string | null = body.rolPermisosId === undefined ? usuario.rolPermisosId : body.rolPermisosId || null;

  if (cargoIds && cargoIds.length > 0) {
    const encontrados = await db.cargo.count({ where: { id: { in: cargoIds } } });
    if (encontrados !== cargoIds.length) {
      return NextResponse.json({ error: "Alguno de los cargos seleccionados no existe." }, { status: 400 });
    }
  }
  if (rolPermisosId && !(await db.rol.findUnique({ where: { id: rolPermisosId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Rol de acceso no encontrado." }, { status: 400 });
  }

  await db.usuario.update({
    where: { id },
    data: {
      rol,
      rolPermisosId,
      ...(cargoIds ? { cargos: { set: cargoIds.map((cargoId) => ({ id: cargoId })) } } : {}),
    },
  });

  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó a "${usuario.nombre}" (${usuario.email}): rol ${rol}.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
