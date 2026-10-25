import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { esContratista } from "@/lib/jerarquia-firma";
import { notificar } from "@/lib/notificaciones";
import { rangoTexto } from "@/lib/planeador-db";
import { ETIQUETA_ROL_PARTICIPANTE, esRolParticipante, validarParticipantes, type ParticipanteEntrada } from "@/lib/participantes-visita";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedePlanearVisitas(permisos)) {
    return NextResponse.json({ error: "Solo quien planea las visitas puede asignar el equipo y los firmantes." }, { status: 403 });
  }

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    select: { id: true, estado: true, expedienteId: true, fechaHora: true, fechaHoraFin: true, lugar: true, participantes: { select: { usuarioId: true } }, expediente: { select: { archivado: true, numero: true } }, visitaTecnica: { select: { finalizadaEn: true, pasoNumero: true } } },
  });
  if (!visita) return NextResponse.json({ error: "Visita no encontrada." }, { status: 404 });
  if (visita.expediente.archivado) return NextResponse.json({ error: "El expediente está cerrado y archivado." }, { status: 409 });
  if (visita.estado === "CANCELADA" || visita.estado === "NO_REALIZADA") {
    return NextResponse.json({ error: "La visita no se realizó; no admite equipo ni firmantes." }, { status: 409 });
  }
  if (visita.visitaTecnica?.finalizadaEn) {
    return NextResponse.json({ error: "El concepto ya se finalizó y se envió a firma; el equipo no se puede cambiar." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { participantes?: unknown } | null;
  const crudos = Array.isArray(body?.participantes) ? body.participantes : [];
  const lista: ParticipanteEntrada[] = [];
  for (const p of crudos as { usuarioId?: unknown; rol?: unknown }[]) {
    if (typeof p?.usuarioId !== "string" || !esRolParticipante(p.rol)) return NextResponse.json({ error: "Datos de participante inválidos." }, { status: 400 });
    lista.push({ usuarioId: p.usuarioId, rol: p.rol });
  }

  const usuarios = await db.usuario.findMany({
    where: { id: { in: lista.map((p) => p.usuarioId) }, activo: true },
    select: { id: true, nombre: true, denominacionEmpleo: true, rolesContratacion: true, contratista: { select: { id: true } }, modulosAcceso: true },
  });
  const error = validarParticipantes(lista, {
    permitidos: new Set(usuarios.map((u) => u.id)),
    contratistas: new Set(usuarios.filter((u) => u.contratista || esContratista(u)).map((u) => u.id)),
    nombres: new Map(usuarios.map((u) => [u.id, u.nombre])),
  });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));
  await db.$transaction([
    db.participanteVisita.deleteMany({ where: { visitaId: id } }),
    db.participanteVisita.createMany({ data: lista.map((p) => ({ visitaId: id, usuarioId: p.usuarioId, rol: p.rol })) }),
    ...usuarios
      .filter((u) => !u.modulosAcceso.includes("TRAMITES"))
      .map((u) => db.usuario.update({ where: { id: u.id }, data: { modulosAcceso: { push: "TRAMITES" } } })),
    db.expedienteEvento.create({
      data: {
        expedienteId: visita.expedienteId,
        tipo: "ASIGNACION_CAMBIADA",
        pasoNumero: visita.visitaTecnica?.pasoNumero ?? null,
        descripcion: `${session.nombre} definió el equipo de la visita técnica: ${lista.map((p) => `${nombre.get(p.usuarioId)} (${ETIQUETA_ROL_PARTICIPANTE[p.rol].toLowerCase()})`).join("; ")}.`,
        usuarioId: session.userId,
      },
    }),
  ]);
  const previos = new Set(visita.participantes.map((p) => p.usuarioId));
  for (const p of lista.filter((x) => !previos.has(x.usuarioId) && x.usuarioId !== session.userId)) {
    await notificar([p.usuarioId], {
      tipo: "EQUIPO_VISITA",
      clave: `equipo-visita:${id}`,
      titulo: `Equipo de visita técnica · ${visita.expediente.numero}`,
      mensaje: `Fue incluido(a) en el equipo de la visita (${ETIQUETA_ROL_PARTICIPANTE[p.rol].toLowerCase()}): ${rangoTexto(visita.fechaHora, visita.fechaHoraFin)}, ${visita.lugar}. Puede consultar el expediente completo.`,
      enlace: `/expedientes/${visita.expedienteId}/visitas/${id}`,
      expedienteId: visita.expedienteId,
    });
  }
  return NextResponse.json({ ok: true });
}
