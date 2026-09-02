import { NextRequest, NextResponse } from "next/server";
import type { NivelAccesoTramite } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

const NIVELES_VALIDOS: NivelAccesoTramite[] = ["VER", "EDITAR"];

/**
 * Editar cargo(s)/rol/acceso por trámite de un usuario YA EXISTENTE — antes no
 * existía (solo se podía crear o activar/desactivar), lo que dejaba sin forma
 * de configurar a un funcionario que ya entró por Directorio Activo.
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
  const cargoIds: string[] | undefined = Array.isArray(body.cargoIds)
    ? body.cargoIds.filter((v: unknown): v is string => typeof v === "string")
    : undefined;
  const accesoTramites: { tramiteTipoId: string; nivel: NivelAccesoTramite }[] | undefined = Array.isArray(body.accesoTramites)
    ? body.accesoTramites.filter(
        (a: unknown): a is { tramiteTipoId: string; nivel: NivelAccesoTramite } =>
          typeof a === "object" &&
          a !== null &&
          typeof (a as { tramiteTipoId?: unknown }).tramiteTipoId === "string" &&
          NIVELES_VALIDOS.includes((a as { nivel?: unknown }).nivel as NivelAccesoTramite)
      )
    : undefined;

  if (cargoIds && cargoIds.length > 0) {
    const encontrados = await db.cargo.count({ where: { id: { in: cargoIds } } });
    if (encontrados !== cargoIds.length) {
      return NextResponse.json({ error: "Alguno de los cargos seleccionados no existe." }, { status: 400 });
    }
  }

  await db.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      data: {
        rol,
        ...(cargoIds ? { cargos: { set: cargoIds.map((cargoId) => ({ id: cargoId })) } } : {}),
      },
    });
    if (accesoTramites) {
      await tx.usuarioTramiteAcceso.deleteMany({ where: { usuarioId: id } });
      if (accesoTramites.length > 0) {
        await tx.usuarioTramiteAcceso.createMany({
          data: accesoTramites.map((a) => ({ usuarioId: id, tramiteTipoId: a.tramiteTipoId, nivel: a.nivel })),
        });
      }
    }
  });

  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó a "${usuario.nombre}" (${usuario.email}): rol ${rol}${
      accesoTramites ? `, ${accesoTramites.length} trámite(s) con acceso` : ""
    }.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
