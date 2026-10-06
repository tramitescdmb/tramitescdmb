import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedePlanearVisitas(permisos)) {
    return NextResponse.json(
      { error: "Solo el Coordinador de Evaluación, el Subdirector SEYCA o un administrador pueden cambiar el personal asignado." },
      { status: 403 }
    );
  }

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: { usuariosAsignados: true, cargosAsignados: true },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  if (expediente.archivado) return NextResponse.json({ error: "El expediente está cerrado y archivado." }, { status: 409 });

  const body = (await req.json().catch(() => null)) as { usuarioIds?: unknown; cargoIds?: unknown } | null;
  const usuarioIds = Array.isArray(body?.usuarioIds) ? body.usuarioIds.map(String) : [];
  const cargoIds = Array.isArray(body?.cargoIds) ? body.cargoIds.map(String) : [];

  const [usuarios, cargos] = await Promise.all([
    usuarioIds.length ? db.usuario.findMany({ where: { id: { in: usuarioIds }, activo: true }, select: { id: true, nombre: true } }) : [],
    cargoIds.length ? db.cargo.findMany({ where: { id: { in: cargoIds } }, select: { id: true, nombre: true } }) : [],
  ]);

  const quitados = expediente.usuariosAsignados.filter((u) => !usuarios.some((x) => x.id === u.id));
  if (quitados.length > 0) {
    const conVisitas = await db.visitaProgramada.findMany({
      where: { expedienteId: id, profesionalId: { in: quitados.map((u) => u.id) }, estado: "PROGRAMADA" },
      select: { profesional: { select: { nombre: true } } },
      distinct: ["profesionalId"],
    });
    if (conVisitas.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede retirar a ${conVisitas.map((v) => v.profesional.nombre).join(", ")}: tiene visitas programadas en este expediente. Reasígnelas o cancélelas primero.`,
        },
        { status: 409 }
      );
    }
  }

  await db.expediente.update({
    where: { id },
    data: {
      usuariosAsignados: { set: usuarios.map((u) => ({ id: u.id })) },
      cargosAsignados: { set: cargos.map((c) => ({ id: c.id })) },
    },
  });

  const antes = [...expediente.usuariosAsignados.map((u) => u.nombre), ...expediente.cargosAsignados.map((c) => c.nombre)];
  const despues = [...usuarios.map((u) => u.nombre), ...cargos.map((c) => c.nombre)];
  const descripcion =
    despues.length > 0
      ? `${session.nombre} asignó el expediente a: ${despues.join(", ")}.`
      : `${session.nombre} quitó la asignación del expediente${antes.length ? ` (antes: ${antes.join(", ")})` : ""}.`;

  await db.expedienteEvento.create({
    data: { expedienteId: id, tipo: "ASIGNACION_CAMBIADA", descripcion, usuarioId: session.userId },
  });

  return NextResponse.json({ ok: true });
}
