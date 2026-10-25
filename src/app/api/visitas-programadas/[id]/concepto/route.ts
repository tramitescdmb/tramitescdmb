import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarExpediente, puedePlanearVisitas } from "@/lib/permisos";
import { ConsecutivoNoConfigurado, etiquetaConcepto, tomarNumeroConcepto } from "@/lib/concepto-tecnico";
import { partesColombia } from "@/lib/planeador";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    select: { profesionalId: true, expedienteId: true, visitaTecnica: { select: { id: true, conceptoNumero: true, formatoVersionId: true, pasoNumero: true } } },
  });
  const vt = visita?.visitaTecnica;
  if (!visita || !vt) return NextResponse.json({ error: "La visita no tiene hoja registrada." }, { status: 404 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedePlanearVisitas(permisos) && session.userId !== visita.profesionalId) {
    return NextResponse.json({ error: "Solo el profesional de la visita o quien planea las visitas puede asignar el número." }, { status: 403 });
  }
  if (!(await puedeEditarExpediente(session.userId, visita.expedienteId))) {
    return NextResponse.json({ error: "Su acceso a este trámite es de solo lectura." }, { status: 403 });
  }
  if (!vt.formatoVersionId) return NextResponse.json({ error: "La visita no se diligenció con un formato." }, { status: 409 });
  if (vt.conceptoNumero) return NextResponse.json({ error: "El concepto ya tiene número." }, { status: 409 });

  const ahora = new Date();
  const anio = Number(partesColombia(ahora).fecha.slice(0, 4));
  let numero: string;
  try {
    numero = await tomarNumeroConcepto(anio);
  } catch (e) {
    if (e instanceof ConsecutivoNoConfigurado) {
      return NextResponse.json({ error: `${e.message} El administrador o el subdirector debe indicar el siguiente número en «Formatos de visita».` }, { status: 409 });
    }
    throw e;
  }

  try {
    await db.$transaction([
      db.visitaTecnica.update({ where: { id: vt.id, conceptoFecha: null }, data: { conceptoNumero: numero, conceptoFecha: ahora } }),
      db.expedienteEvento.create({
        data: {
          expedienteId: visita.expedienteId,
          tipo: "VISITA_REGISTRADA",
          pasoNumero: vt.pasoNumero,
          descripcion: `${session.nombre} asignó el número de concepto técnico ${etiquetaConcepto(numero, ahora)}.`,
          usuarioId: session.userId,
        },
      }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2025" || e.code === "P2002")) {
      return NextResponse.json({ error: "El concepto ya recibió número en otra sesión. Recargue la página." }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ numero: etiquetaConcepto(numero, ahora) });
}
