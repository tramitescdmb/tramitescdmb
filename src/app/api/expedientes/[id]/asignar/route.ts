import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificar, sincronizarAvisoVisita } from "@/lib/notificaciones";
import { tramiteFinalizado } from "@/lib/estados-expediente";
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
    include: {
      usuariosAsignados: true,
      cargosAsignados: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { pasos: { select: { numero: true, titulo: true } } } },
    },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  if (expediente.archivado) return NextResponse.json({ error: "El expediente está cerrado y archivado." }, { status: 409 });
  if (tramiteFinalizado(expediente)) {
    return NextResponse.json({ error: "El trámite ya finalizó: no se puede cambiar el personal asignado." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { usuarioIds?: unknown; cargoIds?: unknown } | null;
  const usuarioIds = Array.isArray(body?.usuarioIds) ? body.usuarioIds.map(String) : [];
  const cargoIds = Array.isArray(body?.cargoIds) ? body.cargoIds.map(String) : [];

  const [usuarios, cargos] = await Promise.all([
    usuarioIds.length ? db.usuario.findMany({ where: { id: { in: usuarioIds }, activo: true }, select: { id: true, nombre: true, modulosAcceso: true } }) : [],
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

  const sinModulo = usuarios.filter((u) => !u.modulosAcceso.includes("TRAMITES"));
  await db.$transaction([
    db.expediente.update({
      where: { id },
      data: {
        usuariosAsignados: { set: usuarios.map((u) => ({ id: u.id })) },
        cargosAsignados: { set: cargos.map((c) => ({ id: c.id })) },
      },
    }),
    ...sinModulo.map((u) => db.usuario.update({ where: { id: u.id }, data: { modulosAcceso: { push: "TRAMITES" } } })),
  ]);

  const agregados = usuarios.filter((u) => !expediente.usuariosAsignados.some((x) => x.id === u.id));
  const cargosAgregados = cargos.filter((c) => !expediente.cargosAsignados.some((x) => x.id === c.id));
  const cargosQuitados = expediente.cargosAsignados.filter((c) => !cargos.some((x) => x.id === c.id));
  const partes = [
    agregados.length || cargosAgregados.length ? `asignó a ${[...agregados, ...cargosAgregados].map((x) => x.nombre).join(", ")}` : "",
    quitados.length || cargosQuitados.length ? `retiró a ${[...quitados, ...cargosQuitados].map((x) => x.nombre).join(", ")}` : "",
  ].filter(Boolean);
  if (partes.length === 0) return NextResponse.json({ ok: true, sinCambios: true });
  const despues = [...usuarios.map((u) => u.nombre), ...cargos.map((c) => c.nombre)];
  const descripcion = `${session.nombre} ${partes.join(" y ")}. Personal asignado: ${despues.length ? despues.join(", ") : "nadie"}.`;

  await db.expedienteEvento.create({
    data: { expedienteId: id, tipo: "ASIGNACION_CAMBIADA", descripcion, usuarioId: session.userId },
  });

  const clave = `asignacion:${id}`;
  const paso = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);
  await notificar(
    agregados.map((u) => u.id).filter((u) => u !== session.userId),
    {
      tipo: "EXPEDIENTE_ASIGNADO",
      clave,
      titulo: `Expediente asignado · ${expediente.numero}`,
      mensaje: `${session.nombre} le asignó el expediente del trámite ${expediente.tramiteTipo.nombre}${
        paso ? `, que está en el paso ${paso.numero} (${paso.titulo})` : ""
      }.`,
      enlace: `/expedientes/${id}`,
      expedienteId: id,
    },
    { reenviarCorreo: true }
  );
  if (quitados.length > 0) {
    await db.notificacion.updateMany({
      where: { clave, usuarioId: { in: quitados.map((u) => u.id) }, resueltaEn: null },
      data: { resueltaEn: new Date() },
    });
  }

  await sincronizarAvisoVisita(id);

  return NextResponse.json({ ok: true });
}
