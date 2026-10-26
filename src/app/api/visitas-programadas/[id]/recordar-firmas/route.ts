import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { notificar } from "@/lib/notificaciones";

const ESPERA_ENTRE_RECORDATORIOS_MS = 4 * 60 * 60 * 1000;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    select: {
      profesionalId: true,
      expedienteId: true,
      expediente: { select: { numero: true } },
      participantes: { select: { usuarioId: true, rol: true } },
      visitaTecnica: {
        select: {
          conceptoNumero: true,
          finalizadaPorId: true,
          documentoConcepto: {
            select: {
              solicitudesFirma: {
                where: { rol: { not: "LECTURA" } },
                select: { id: true, rol: true, orden: true, estado: true, recordadoEn: true, usuarioAsignadoId: true, usuarioAsignado: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
  });
  const vt = visita?.visitaTecnica;
  const solicitudes = vt?.documentoConcepto?.solicitudesFirma;
  if (!visita || !vt || !solicitudes) return NextResponse.json({ error: "El concepto no está en firma." }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  const vinculado =
    session.userId === visita.profesionalId ||
    session.userId === vt.finalizadaPorId ||
    visita.participantes.some((p) => p.usuarioId === session.userId);
  if (!vinculado && !puedePlanearVisitas(permisos)) {
    return NextResponse.json({ error: "Solo el equipo de la visita o quien planea las visitas puede enviar el recordatorio." }, { status: 403 });
  }

  const enTurno = solicitudes.filter((s) => s.estado === "PENDIENTE" && s.usuarioAsignadoId !== session.userId && puedeActuarSolicitud(solicitudes, s));
  if (enTurno.length === 0) return NextResponse.json({ error: "No hay firmas pendientes a las que corresponda el turno." }, { status: 409 });
  const limite = Date.now() - ESPERA_ENTRE_RECORDATORIOS_MS;
  const porAvisar = enTurno.filter((s) => !s.recordadoEn || s.recordadoEn.getTime() < limite);

  if (porAvisar.length > 0) {
    await db.solicitudFirma.updateMany({ where: { id: { in: porAvisar.map((s) => s.id) } }, data: { recordadoEn: new Date(), recordadoPorId: session.userId } });
    for (const s of porAvisar) {
      await notificar([s.usuarioAsignadoId], {
        tipo: "FIRMA_RECORDADA",
        clave: `firma-recordada:${s.id}`,
        titulo: `Se espera su ${s.rol === "VISTO_BUENO" ? "visto bueno" : "firma"} · concepto ${vt.conceptoNumero}`,
        mensaje: `${session.nombre} le recuerda que el concepto técnico del expediente ${visita.expediente.numero} espera su ${s.rol === "VISTO_BUENO" ? "visto bueno" : "firma"}.`,
        enlace: `/firmas/firmar/${s.id}`,
        expedienteId: visita.expedienteId,
      });
    }
  }
  return NextResponse.json({
    avisados: porAvisar.map((s) => s.usuarioAsignado.nombre),
    yaAvisados: enTurno.filter((s) => !porAvisar.includes(s)).map((s) => s.usuarioAsignado.nombre),
  });
}
