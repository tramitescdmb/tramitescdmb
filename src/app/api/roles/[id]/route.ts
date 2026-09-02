import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar roles." }, { status: 403 });
  }

  const rolExistente = await db.rol.findUnique({ where: { id } });
  if (!rolExistente) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const nombre = String(body.nombre || "").trim();
  const descripcion = String(body.descripcion || "").trim() || null;
  const todosLosTramites = body.todosLosTramites !== false;
  const tramiteIds: string[] = Array.isArray(body.tramiteIds) ? body.tramiteIds.filter((v: unknown) => typeof v === "string") : [];
  const activo = body.activo !== false;

  if (!nombre) return NextResponse.json({ error: "Falta el nombre del rol." }, { status: 400 });

  const otroConMismoNombre = await db.rol.findUnique({ where: { nombre } });
  if (otroConMismoNombre && otroConMismoNombre.id !== id) {
    return NextResponse.json({ error: "Ya existe otro rol con ese nombre." }, { status: 409 });
  }

  await db.rol.update({
    where: { id },
    data: {
      nombre,
      descripcion,
      todosLosTramites,
      activo,
      tramites: {
        deleteMany: {},
        ...(todosLosTramites ? {} : { create: tramiteIds.map((tramiteTipoId) => ({ tramiteTipoId })) }),
      },
    },
  });

  await registrarAuditoria({
    tipo: "ROL_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó el rol de acceso "${nombre}".`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
