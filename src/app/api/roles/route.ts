import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede crear roles." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const nombre = String(body.nombre || "").trim();
  const descripcion = String(body.descripcion || "").trim() || null;
  const todosLosTramites = body.todosLosTramites !== false;
  const tramiteIds: string[] = Array.isArray(body.tramiteIds) ? body.tramiteIds.filter((id: unknown) => typeof id === "string") : [];
  const activo = body.activo !== false;

  if (!nombre) return NextResponse.json({ error: "Falta el nombre del rol." }, { status: 400 });

  const existente = await db.rol.findUnique({ where: { nombre } });
  if (existente) return NextResponse.json({ error: "Ya existe un rol con ese nombre." }, { status: 409 });

  const rol = await db.rol.create({
    data: {
      nombre,
      descripcion,
      todosLosTramites,
      activo,
      tramites: todosLosTramites
        ? undefined
        : { create: tramiteIds.map((tramiteTipoId) => ({ tramiteTipoId })) },
    },
  });

  await registrarAuditoria({
    tipo: "ROL_CREADO",
    descripcion: `${session.nombre} creó el rol de acceso "${rol.nombre}".`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ id: rol.id });
}
