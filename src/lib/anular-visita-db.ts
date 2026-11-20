import { db } from "@/lib/db";
import { bloqueoCancelarVisita, bloqueoEliminarVisita, type VisitaParaAnular } from "@/lib/anular-visita";
import { rangoTexto } from "@/lib/planeador-db";
import { avisarProfesionalVisita, resolverNotificaciones, sincronizarAvisoVisita } from "@/lib/notificaciones";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";

type Usuario = { id: string; nombre: string };
type Resultado = { ok: true } | { error: string; status: number };

class ConceptoEnFirma extends Error {}

async function cargar(id: string) {
  return db.visitaProgramada.findUnique({
    where: { id },
    include: {
      profesional: { select: { nombre: true } },
      expediente: { select: { id: true, numero: true, archivado: true } },
      visitaTecnica: {
        select: { id: true, pasoNumero: true, finalizadaEn: true, conceptoNumero: true, documentoConceptoId: true, conceptoDescartadoEn: true },
      },
    },
  });
}

function paraReglas(v: NonNullable<Awaited<ReturnType<typeof cargar>>>): VisitaParaAnular {
  return { estado: v.estado, expedienteArchivado: v.expediente.archivado, hoja: v.visitaTecnica };
}

async function resolverAvisosDeVisita(id: string) {
  for (const clave of [`visita:${id}`, `equipo-visita:${id}`, `concepto-revision:${id}`, `concepto-devuelto:${id}`, `concepto:${id}`]) {
    await resolverNotificaciones({ clave });
  }
}

/**
 * Cancela una visita en cualquier estado (programada, realizada o no realizada) — solo para el
 * administrador y el Subdirector(a) SEYCA. Conserva la visita y su hoja; si tiene un borrador de
 * concepto técnico, lo descarta con el mismo motivo para que no bloquee el cierre del expediente.
 */
export async function cancelarVisitaComoAnulador(id: string, usuario: Usuario, motivo: string, peticion: { ip: string | null; userAgent: string | null }): Promise<Resultado> {
  const texto = motivo.trim();
  if (!texto) return { error: "Indique el motivo de la cancelación.", status: 400 };
  const v = await cargar(id);
  if (!v) return { error: "Visita no encontrada.", status: 404 };
  const bloqueo = bloqueoCancelarVisita(paraReglas(v));
  if (bloqueo) return { error: bloqueo, status: 409 };

  const vt = v.visitaTecnica;
  const cuando = rangoTexto(v.fechaHora, v.fechaHoraFin);
  const estadoAnterior = v.estado;
  const descartaConcepto = Boolean(vt && !vt.conceptoDescartadoEn);

  const hecho = await db.$transaction(async (tx) => {
    const { count } = await tx.visitaProgramada.updateMany({
      where: { id, estado: estadoAnterior },
      data: { estado: "CANCELADA", motivoCambio: texto },
    });
    if (count === 0) return false;
    if (vt && descartaConcepto) {
      // Solo si el concepto sigue sin enviarse a firma (otra sesión pudo finalizarlo entretanto).
      const r = await tx.visitaTecnica.updateMany({
        where: { id: vt.id, finalizadaEn: null, documentoConceptoId: null, conceptoDescartadoEn: null },
        data: { conceptoDescartadoEn: new Date(), conceptoDescartadoPorId: usuario.id, motivoDescarteConcepto: `Visita cancelada: ${texto}` },
      });
      if (r.count === 0) throw new ConceptoEnFirma();
      await tx.revisionConcepto.create({ data: { visitaTecnicaId: vt.id, accion: "DESCARTE", usuarioId: usuario.id, comentario: `Visita cancelada: ${texto}` } });
    }
    await tx.expedienteEvento.create({
      data: {
        expedienteId: v.expedienteId,
        tipo: "VISITA_PROGRAMADA",
        pasoNumero: vt?.pasoNumero,
        descripcion:
          `${usuario.nombre} canceló la visita técnica del ${cuando} (${v.profesional.nombre})` +
          (estadoAnterior !== "PROGRAMADA" ? `, que estaba ${estadoAnterior === "REALIZADA" ? "realizada" : "reportada como no realizada"}` : "") +
          (descartaConcepto ? "; el borrador del concepto técnico quedó descartado" : "") +
          `. Motivo: ${texto}`,
        usuarioId: usuario.id,
      },
    });
    return true;
  }).catch((e: unknown) => {
    if (e instanceof ConceptoEnFirma) return "firma" as const;
    throw e;
  });
  if (hecho === "firma") return { error: bloqueoCancelarVisita({ ...paraReglas(v), hoja: { ...vt!, finalizadaEn: new Date() } })!, status: 409 };
  if (!hecho) return { error: "La visita cambió mientras tanto. Recargue la página.", status: 409 };

  await registrarAuditoriaDoc({
    entidad: "VisitaProgramada",
    entidadId: id,
    accion: "ANULA",
    usuarioId: usuario.id,
    ...peticion,
    detalle: `Canceló la visita del ${cuando} del expediente ${v.expediente.numero} (estaba ${estadoAnterior}${descartaConcepto ? "; concepto en borrador descartado" : ""}). Motivo: ${texto}`,
  });
  if (estadoAnterior === "PROGRAMADA") await avisarProfesionalVisita(id, "VISITA_CANCELADA", usuario.id);
  else await resolverAvisosDeVisita(id);
  await sincronizarAvisoVisita(v.expedienteId);
  return { ok: true };
}

/**
 * Elimina definitivamente una visita sin hoja de visita — solo para el administrador y el
 * Subdirector(a) SEYCA. Deja constancia en el historial del expediente y en la auditoría.
 */
export async function eliminarVisita(id: string, usuario: Usuario, motivo: string, peticion: { ip: string | null; userAgent: string | null }): Promise<Resultado> {
  const texto = motivo.trim();
  if (!texto) return { error: "Indique por qué se elimina la visita.", status: 400 };
  const v = await cargar(id);
  if (!v) return { error: "Visita no encontrada.", status: 404 };
  const bloqueo = bloqueoEliminarVisita(paraReglas(v));
  if (bloqueo) return { error: bloqueo, status: 409 };

  const cuando = rangoTexto(v.fechaHora, v.fechaHoraFin);
  const participantes = await db.participanteVisita.findMany({ where: { visitaId: id }, select: { usuarioId: true, rol: true } });

  // Aviso al profesional y al equipo antes de borrar (el aviso necesita leer la visita).
  const avisar = v.estado === "PROGRAMADA" && v.fechaHora.getTime() > Date.now();
  if (avisar) {
    await db.visitaProgramada.update({ where: { id }, data: { motivoCambio: `Visita eliminada: ${texto}` } });
    await avisarProfesionalVisita(id, "VISITA_CANCELADA", usuario.id);
  }

  const borrada = await db.$transaction(async (tx) => {
    // Solo si sigue sin hoja: si alguien la registró entretanto, no se borra.
    const { count } = await tx.visitaProgramada.deleteMany({ where: { id, visitaTecnica: { is: null } } });
    if (count === 0) return false;
    await tx.expedienteEvento.create({
      data: {
        expedienteId: v.expedienteId,
        tipo: "VISITA_PROGRAMADA",
        descripcion: `${usuario.nombre} eliminó la visita técnica del ${cuando} en ${v.lugar} (${v.profesional.nombre}), que estaba ${v.estado.toLowerCase().replace("_", " ")}. Motivo: ${texto}`,
        usuarioId: usuario.id,
      },
    });
    return true;
  });
  if (!borrada) {
    if (avisar) await db.visitaProgramada.updateMany({ where: { id }, data: { motivoCambio: v.motivoCambio } });
    return { error: "La visita ya tiene hoja registrada o fue eliminada en otra sesión. Recargue la página.", status: 409 };
  }

  await registrarAuditoriaDoc({
    entidad: "VisitaProgramada",
    entidadId: id,
    accion: "ELIMINA",
    usuarioId: usuario.id,
    ...peticion,
    detalle: JSON.stringify({
      motivo: texto,
      expediente: v.expediente.numero,
      estado: v.estado,
      fechaHora: v.fechaHora.toISOString(),
      fechaHoraFin: v.fechaHoraFin?.toISOString() ?? null,
      lugar: v.lugar,
      profesionalId: v.profesionalId,
      programadaPorId: v.programadaPorId,
      observaciones: v.observaciones,
      motivoCambioAnterior: v.motivoCambio,
      participantes,
    }),
  });
  await resolverAvisosDeVisita(id);
  await sincronizarAvisoVisita(v.expedienteId);
  return { ok: true };
}
