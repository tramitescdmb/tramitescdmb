import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede cambiar la asignación." }, { status: 403 });
  }

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: { usuariosAsignados: true, cargosAsignados: true },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const form = await req.formData();
  const usuarioIds = form.getAll("usuarioIds").map(String);
  const cargoIds = form.getAll("cargoIds").map(String);

  const [usuarios, cargos] = await Promise.all([
    usuarioIds.length ? db.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true } }) : [],
    cargoIds.length ? db.cargo.findMany({ where: { id: { in: cargoIds } }, select: { id: true, nombre: true } }) : [],
  ]);

  await db.expediente.update({
    where: { id },
    data: {
      usuariosAsignados: { set: usuarios.map((u) => ({ id: u.id })) },
      cargosAsignados: { set: cargos.map((c) => ({ id: c.id })) },
    },
  });

  const antes = [
    ...expediente.usuariosAsignados.map((u) => u.nombre),
    ...expediente.cargosAsignados.map((c) => c.nombre),
  ];
  const despues = [...usuarios.map((u) => u.nombre), ...cargos.map((c) => c.nombre)];
  const descripcion =
    despues.length > 0
      ? `${session.nombre} asignó el expediente a: ${despues.join(", ")}.`
      : `${session.nombre} quitó la asignación del expediente${antes.length ? ` (antes: ${antes.join(", ")})` : ""}.`;

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: "ASIGNACION_CAMBIADA",
      descripcion,
      usuarioId: session.userId,
    },
  });

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
