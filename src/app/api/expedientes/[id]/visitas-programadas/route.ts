import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { expedienteEnEjecucion, horaCorta } from "@/lib/planeador";
import { buscarCruceVisita, leerDatosVisita } from "@/lib/planeador-db";
import { formatearFecha } from "@/lib/fecha";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedePlanearVisitas(permisos)) {
    return NextResponse.json(
      { error: "Solo el Coordinador de Evaluación, el Subdirector SEYCA o un administrador pueden programar visitas." },
      { status: 403 }
    );
  }

  const expediente = await db.expediente.findUnique({
    where: { id },
    select: { id: true, numero: true, estado: true, archivado: true, usuariosAsignados: { select: { id: true, nombre: true } } },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  if (!expedienteEnEjecucion(expediente)) {
    return NextResponse.json({ error: "Solo se programan visitas en trámites en ejecución." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const datos = leerDatosVisita(body);
  if (typeof datos === "string") return NextResponse.json({ error: datos }, { status: 400 });

  const profesional = expediente.usuariosAsignados.find((u) => u.id === datos.profesionalId);
  if (!profesional) {
    return NextResponse.json({ error: "El profesional debe estar en el personal asignado del expediente." }, { status: 400 });
  }
  if (datos.fechaHora.getTime() < Date.now() - 60 * 60 * 1000) {
    return NextResponse.json({ error: "La fecha de la visita no puede estar en el pasado." }, { status: 400 });
  }
  if (!body?.forzar) {
    const cruce = await buscarCruceVisita(datos.profesionalId, datos.fechaHora);
    if (cruce) return NextResponse.json({ error: cruce, cruce: true }, { status: 409 });
  }

  await db.$transaction([
    db.visitaProgramada.create({
      data: { expedienteId: id, ...datos, programadaPorId: session.userId },
    }),
    db.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "VISITA_PROGRAMADA",
        descripcion: `${session.nombre} programó la visita técnica para el ${formatearFecha(datos.fechaHora)} a las ${horaCorta(datos.fechaHora)} en ${datos.lugar}, a cargo de ${profesional.nombre}.`,
        usuarioId: session.userId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
