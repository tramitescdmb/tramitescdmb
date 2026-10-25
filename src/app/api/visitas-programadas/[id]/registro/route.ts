import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarExpediente, puedePlanearVisitas } from "@/lib/permisos";
import { desdeLatLon, esLatLonValido } from "@/lib/coordenadas";
import { puntoEnJurisdiccionCdmb } from "@/lib/jurisdiccion-cdmb-servidor";
import { expedienteEnEjecucion, fechaHoraColombia } from "@/lib/planeador";
import { rangoTexto } from "@/lib/planeador-db";
import { codigoProcedimiento, normalizarNombreTema } from "@/lib/temas-visita";
import { resolverNotificaciones, sincronizarAvisoVisita } from "@/lib/notificaciones";
import type { Prisma } from "@prisma/client";
import { camposObligatoriosFaltantes, sanearRespuestas, type Respuestas } from "@/lib/formato-visita";
import { estructuraDesdeJson } from "@/lib/formatos-visita-db";

const RESULTADOS = ["VIABLE", "REQUIERE_INFORMACION", "NO_VIABLE", "EN_ANALISIS"] as const;

function texto(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const visita = await db.visitaProgramada.findUnique({
    where: { id },
    include: {
      profesional: { select: { nombre: true } },
      expediente: { select: { id: true, estado: true, archivado: true, pasoActualNumero: true, tramiteTipo: { select: { codigo: true } } } },
    },
  });
  if (!visita) return NextResponse.json({ error: "Visita no encontrada." }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedePlanearVisitas(permisos) && session.userId !== visita.profesionalId) {
    return NextResponse.json({ error: "Solo el profesional asignado a la visita o quien planea las visitas puede registrarla." }, { status: 403 });
  }
  if (session.userId !== visita.profesionalId && !(await puedeEditarExpediente(session.userId, visita.expedienteId))) {
    return NextResponse.json({ error: "Su acceso a este trámite es de solo lectura." }, { status: 403 });
  }
  if (!expedienteEnEjecucion(visita.expediente)) {
    return NextResponse.json({ error: "El trámite ya no está en ejecución." }, { status: 409 });
  }
  if (visita.estado !== "PROGRAMADA") {
    return NextResponse.json({ error: "Esta visita ya fue cerrada." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!esLatLonValido(lat, lon)) return NextResponse.json({ error: "Capture el punto de la visita." }, { status: 400 });
  const precisionM = body.precisionM != null && Number.isFinite(Number(body.precisionM)) ? Number(body.precisionM) : null;
  const capturadoEn = typeof body.capturadoEn === "string" ? new Date(body.capturadoEn) : new Date();

  const fechaReal = typeof body.fechaReal === "string" ? body.fechaReal : "";
  const inicioReal = fechaHoraColombia(fechaReal, typeof body.horaInicioReal === "string" ? body.horaInicioReal : "");
  const finReal = fechaHoraColombia(fechaReal, typeof body.horaFinReal === "string" ? body.horaFinReal : "");
  if (!inicioReal || !finReal) return NextResponse.json({ error: "Indique la fecha y las horas reales de la visita." }, { status: 400 });
  if (finReal <= inicioReal) return NextResponse.json({ error: "La hora de finalización debe ser posterior a la de inicio." }, { status: 400 });
  if (inicioReal.getTime() > Date.now() + 15 * 60 * 1000) {
    return NextResponse.json({ error: "No se puede registrar una visita que aún no ha ocurrido." }, { status: 400 });
  }

  const resultado = RESULTADOS.find((r) => r === body.resultado);
  if (!resultado) return NextResponse.json({ error: "Seleccione el resultado de la visita." }, { status: 400 });

  const codigo = codigoProcedimiento(visita.expediente.tramiteTipo.codigo);
  let formatoVersion: { id: string; numero: number; codigo: string } | null = null;
  let respuestas: Respuestas | null = null;
  if (typeof body.formatoVersionId === "string" && body.formatoVersionId) {
    const v = await db.formatoVisitaVersion.findUnique({
      where: { id: body.formatoVersionId },
      select: { id: true, numero: true, estado: true, estructura: true, formato: { select: { codigo: true, tramites: true, porDefecto: true } } },
    });
    if (!v || v.estado === "BORRADOR" || !(v.formato.tramites.includes(codigo) || v.formato.porDefecto)) {
      return NextResponse.json({ error: "El formato de visita ya no corresponde a este trámite. Recargue la página." }, { status: 409 });
    }
    const estructura = estructuraDesdeJson(v.estructura);
    respuestas = sanearRespuestas(estructura, body.respuestas);
    const faltan = camposObligatoriosFaltantes(estructura, respuestas);
    if (faltan.length) return NextResponse.json({ error: `Complete los campos obligatorios del formato: ${faltan.join("; ")}.` }, { status: 400 });
    formatoVersion = { id: v.id, numero: v.numero, codigo: v.formato.codigo };
  }

  const hallazgos = texto(body.hallazgos, 10_000);
  if (!hallazgos && !formatoVersion) return NextResponse.json({ error: "Describa lo observado en la visita." }, { status: 400 });

  const temaIds = Array.isArray(body.temaIds) ? body.temaIds.map(String) : [];
  const temasNuevos = Array.isArray(body.temasNuevos)
    ? [...new Set(body.temasNuevos.map((t) => normalizarNombreTema(String(t))).filter((t) => t.length >= 3 && t.length <= 150))]
    : [];
  if (temaIds.length + temasNuevos.length === 0 && !formatoVersion) {
    return NextResponse.json({ error: "Seleccione al menos un tema de la visita." }, { status: 400 });
  }

  const c = desdeLatLon(lat, lon);
  const pasoNumero = visita.expediente.pasoActualNumero;

  const idsNuevos: string[] = [];
  for (const nombre of temasNuevos) {
    const existente = await db.temaVisita.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
    if (existente) {
      if (!existente.codigosTramite.includes(codigo) && existente.codigosTramite.length > 0) {
        await db.temaVisita.update({ where: { id: existente.id }, data: { codigosTramite: { push: codigo } } });
      }
      idsNuevos.push(existente.id);
    } else {
      const creado = await db.temaVisita.upsert({
        where: { nombre },
        update: {},
        create: { nombre, codigosTramite: [codigo], creadoPorId: session.userId },
      });
      idsNuevos.push(creado.id);
    }
  }
  const temasValidos = await db.temaVisita.findMany({ where: { id: { in: [...temaIds, ...idsNuevos] } }, select: { id: true, nombre: true } });
  if (temasValidos.length === 0 && !formatoVersion) return NextResponse.json({ error: "Seleccione al menos un tema de la visita." }, { status: 400 });
  const recibe = respuestas && typeof respuestas.recibe_visita === "string" ? respuestas.recibe_visita : null;
  const detalle = formatoVersion ? `formato ${formatoVersion.codigo} v${formatoVersion.numero}` : `temas: ${temasValidos.map((t) => t.nombre).join("; ")}`;

  const [visitaTecnica] = await db.$transaction([
    db.visitaTecnica.create({
      data: {
        expedienteId: visita.expedienteId,
        pasoNumero,
        lat: c.lat,
        lon: c.lon,
        planaX: c.planaX,
        planaY: c.planaY,
        cartesianaX: c.cartesianaX,
        cartesianaY: c.cartesianaY,
        cartesianaZ: c.cartesianaZ,
        precisionM,
        capturaManual: body.capturaManual === true,
        fueraJurisdiccion: !puntoEnJurisdiccionCdmb(lat, lon),
        capturadoPorId: session.userId,
        capturadoEn: Number.isNaN(capturadoEn.getTime()) ? new Date() : capturadoEn,
        visitaProgramadaId: id,
        inicioReal,
        finReal,
        atendidoPor: texto(body.atendidoPor, 200) ?? texto(recibe, 200),
        hallazgos,
        recomendaciones: texto(body.recomendaciones, 10_000),
        resultado,
        formatoVersionId: formatoVersion?.id ?? null,
        ...(respuestas ? { respuestas: respuestas as unknown as Prisma.InputJsonValue } : {}),
        temas: { connect: temasValidos.map((t) => ({ id: t.id })) },
      },
    }),
    db.visitaProgramada.update({ where: { id }, data: { estado: "REALIZADA" } }),
    db.expedienteEvento.create({
      data: {
        expedienteId: visita.expedienteId,
        tipo: "VISITA_REGISTRADA",
        pasoNumero,
        descripcion: `${session.nombre} registró la hoja de la visita técnica del ${rangoTexto(inicioReal, finReal)} (${detalle}).`,
        usuarioId: session.userId,
      },
    }),
    db.expediente.update({ where: { id: visita.expedienteId }, data: { fechaUltimoMovimiento: new Date() } }),
  ]);

  await resolverNotificaciones({ clave: `visita:${id}` });
  await sincronizarAvisoVisita(visita.expedienteId);
  return NextResponse.json({ id: visitaTecnica.id, expedienteId: visita.expedienteId });
}
