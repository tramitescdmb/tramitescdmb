import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { expedienteEnEjecucion } from "@/lib/planeador";
import { buscarCruceVisita, leerDatosVisita, rangoTexto } from "@/lib/planeador-db";
import { avisarProfesionalVisita, resolverNotificaciones, sincronizarAvisoVisita } from "@/lib/notificaciones";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const planificador = puedePlanearVisitas(permisos);

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    include: {
      profesional: { select: { nombre: true } },
      expediente: { select: { id: true, estado: true, archivado: true, usuariosAsignados: { select: { id: true, nombre: true } } } },
    },
  });
  if (!visita) return NextResponse.json({ error: "Visita no encontrada." }, { status: 404 });
  if (!expedienteEnEjecucion(visita.expediente)) {
    return NextResponse.json({ error: "El trámite ya no está en ejecución." }, { status: 409 });
  }
  if (visita.estado !== "PROGRAMADA") {
    return NextResponse.json({ error: "La visita ya fue cerrada y no admite cambios." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = body?.accion;
  const cuando = rangoTexto(visita.fechaHora, visita.fechaHoraFin);
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";

  if (accion === "no_realizada") {
    if (!planificador && session.userId !== visita.profesionalId) {
      return NextResponse.json({ error: "Solo el profesional asignado o quien planea las visitas puede reportarla como no realizada." }, { status: 403 });
    }
    if (!motivo) return NextResponse.json({ error: "Indique por qué no se pudo realizar la visita." }, { status: 400 });
    await db.$transaction([
      db.visitaProgramada.update({ where: { id }, data: { estado: "NO_REALIZADA", motivoCambio: motivo } }),
      db.expedienteEvento.create({
        data: {
          expedienteId: visita.expedienteId,
          tipo: "VISITA_PROGRAMADA",
          descripcion: `${session.nombre} reportó que la visita técnica del ${cuando} (${visita.profesional.nombre}) no se pudo realizar. Motivo: ${motivo}`,
          usuarioId: session.userId,
        },
      }),
    ]);
    await resolverNotificaciones({ clave: `visita:${id}` });
    await sincronizarAvisoVisita(visita.expedienteId);
    return NextResponse.json({ ok: true });
  }

  if (!planificador) {
    return NextResponse.json(
      { error: "Solo el Coordinador de Evaluación, el Subdirector SEYCA o un administrador pueden modificar la programación." },
      { status: 403 }
    );
  }

  if (accion === "cancelar") {
    if (!motivo) return NextResponse.json({ error: "Indique el motivo de la cancelación." }, { status: 400 });
    await db.$transaction([
      db.visitaProgramada.update({ where: { id }, data: { estado: "CANCELADA", motivoCambio: motivo } }),
      db.expedienteEvento.create({
        data: {
          expedienteId: visita.expedienteId,
          tipo: "VISITA_PROGRAMADA",
          descripcion: `${session.nombre} canceló la visita técnica del ${cuando} (${visita.profesional.nombre}). Motivo: ${motivo}`,
          usuarioId: session.userId,
        },
      }),
    ]);
    await avisarProfesionalVisita(id, "VISITA_CANCELADA", session.userId);
    await sincronizarAvisoVisita(visita.expedienteId);
    return NextResponse.json({ ok: true });
  }

  if (accion === "editar") {
    const datos = leerDatosVisita(body);
    if (typeof datos === "string") return NextResponse.json({ error: datos }, { status: 400 });
    const profesional = visita.expediente.usuariosAsignados.find((u) => u.id === datos.profesionalId);
    if (!profesional) {
      return NextResponse.json({ error: "El profesional debe estar en el personal asignado del expediente." }, { status: 400 });
    }
    const cambioHorario =
      datos.fechaHora.getTime() !== visita.fechaHora.getTime() || datos.fechaHoraFin.getTime() !== visita.fechaHoraFin?.getTime();
    if (datos.fechaHora.getTime() !== visita.fechaHora.getTime() && datos.fechaHora.getTime() < Date.now() - 60 * 60 * 1000) {
      return NextResponse.json({ error: "La fecha de la visita no puede estar en el pasado." }, { status: 400 });
    }
    if (!body?.forzar && (cambioHorario || datos.profesionalId !== visita.profesionalId)) {
      const cruce = await buscarCruceVisita(datos.profesionalId, datos.fechaHora, datos.fechaHoraFin, id);
      if (cruce) return NextResponse.json({ error: cruce, cruce: true }, { status: 409 });
    }
    await db.$transaction([
      db.visitaProgramada.update({ where: { id }, data: datos }),
      db.expedienteEvento.create({
        data: {
          expedienteId: visita.expedienteId,
          tipo: "VISITA_PROGRAMADA",
          descripcion: `${session.nombre} reprogramó la visita técnica del ${cuando}: ahora el ${rangoTexto(datos.fechaHora, datos.fechaHoraFin)} en ${datos.lugar}, a cargo de ${profesional.nombre}.`,
          usuarioId: session.userId,
        },
      }),
    ]);
    await resolverNotificaciones({ clave: `visita:${id}` });
    await avisarProfesionalVisita(id, datos.profesionalId === visita.profesionalId ? "VISITA_REPROGRAMADA" : "VISITA_PROGRAMADA", session.userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
