import type { TipoActividadPaso, TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";
import { CARGOS_PLANEADOR } from "@/lib/permisos";
import { expedienteEnEjecucion } from "@/lib/planeador";
import { pasoPermiteVisita, tipoActividadEfectivo } from "@/lib/temas-visita";
import { rangoTexto } from "@/lib/planeador-db";
import { avisarEnSegundoPlano, esEventoAviso, escaparHtml, parrafos } from "@/lib/avisos-correo";

type DatosNotificacion = { tipo: TipoNotificacion; clave: string; titulo: string; mensaje: string; enlace: string; expedienteId?: string };

export async function notificar(usuarioIds: string[], datos: DatosNotificacion) {
  const destinatarios = [...new Set(usuarioIds)];
  if (destinatarios.length === 0) return;
  const previas = await db.notificacion.findMany({
    where: { clave: datos.clave, usuarioId: { in: destinatarios } },
    select: { usuarioId: true, resueltaEn: true, tipo: true, titulo: true, mensaje: true },
  });
  const porCorreo = destinatarios.filter((usuarioId) => {
    const p = previas.find((x) => x.usuarioId === usuarioId);
    return !p || p.resueltaEn !== null || p.tipo !== datos.tipo || p.titulo !== datos.titulo || p.mensaje !== datos.mensaje;
  });
  await db.$transaction(
    destinatarios.map((usuarioId) =>
      db.notificacion.upsert({
        where: { usuarioId_clave: { usuarioId, clave: datos.clave } },
        create: { usuarioId, ...datos },
        update: { tipo: datos.tipo, titulo: datos.titulo, mensaje: datos.mensaje, enlace: datos.enlace, leidaEn: null, resueltaEn: null },
      })
    )
  );
  const evento = datos.tipo === "EQUIPO_VISITA" ? "VISITA_PROGRAMADA" : datos.tipo;
  if (!esEventoAviso(evento) || porCorreo.length === 0) return;
  avisarEnSegundoPlano({
    evento,
    clave: `notificacion:${datos.clave}:${Date.now()}`,
    usuarioIds: porCorreo,
    asunto: datos.titulo,
    titulo: datos.titulo,
    cuerpoHtml: parrafos(escaparHtml(datos.mensaje)),
    enlace: { texto: "Abrir en la plataforma", ruta: datos.enlace },
  });
}

export async function resolverNotificaciones(where: { clave?: string; claveEmpiezaPor?: string; expedienteId?: string; tipo?: TipoNotificacion; excepto?: string }) {
  await db.notificacion.updateMany({
    where: {
      resueltaEn: null,
      ...(where.clave ? { clave: where.clave } : {}),
      ...(where.claveEmpiezaPor ? { clave: { startsWith: where.claveEmpiezaPor } } : {}),
      ...(where.excepto ? { NOT: { clave: where.excepto } } : {}),
      ...(where.expedienteId ? { expedienteId: where.expedienteId } : {}),
      ...(where.tipo ? { tipo: where.tipo } : {}),
    },
    data: { resueltaEn: new Date() },
  });
}

export async function planificadoresConAcceso(tramiteTipoId: string): Promise<string[]> {
  const usuarios = await db.usuario.findMany({
    where: {
      activo: true,
      OR: [
        { rol: "ADMIN" },
        { cargoAsignaciones: { some: { cargo: { nombre: { in: CARGOS_PLANEADOR } } } }, tramitesAcceso: { some: { tramiteTipoId } } },
      ],
    },
    select: { id: true },
  });
  return usuarios.map((u) => u.id);
}

export async function sincronizarAvisoVisita(expedienteId: string): Promise<void> {
  const e = await db.expediente.findUnique({
    where: { id: expedienteId },
    select: {
      id: true,
      numero: true,
      estado: true,
      archivado: true,
      pasoActualNumero: true,
      tramiteTipoId: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { pasos: { select: { numero: true, titulo: true, descripcion: true, esDecision: true, tipoActividad: true } } } },
      visitasProgramadas: { select: { estado: true, fechaHora: true }, orderBy: { fechaHora: "desc" } },
      visitasTecnicas: { select: { pasoNumero: true } },
      usuariosAsignados: { select: { id: true } },
    },
  });
  if (!e) return;

  const prefijo = `visita-sin-programar:${e.id}:`;
  const clave = `${prefijo}${e.pasoActualNumero}`;
  const paso = e.flujo.pasos.find((p) => p.numero === e.pasoActualNumero);
  await sincronizarAvisoConcepto(e, paso);
  const requiere =
    expedienteEnEjecucion(e) &&
    !!paso &&
    pasoPermiteVisita(paso.titulo, paso.descripcion, paso.tipoActividad) &&
    !e.visitasProgramadas.some((v) => v.estado === "PROGRAMADA") &&
    !e.visitasTecnicas.some((v) => v.pasoNumero === e.pasoActualNumero);

  if (!requiere || !paso) {
    await resolverNotificaciones({ claveEmpiezaPor: prefijo });
    return;
  }

  await resolverNotificaciones({ claveEmpiezaPor: prefijo, excepto: clave });
  const noRealizada = e.visitasProgramadas[0]?.estado === "NO_REALIZADA";
  await notificar(await planificadoresConAcceso(e.tramiteTipoId), {
    tipo: noRealizada ? "VISITA_NO_REALIZADA" : "VISITA_SIN_PROGRAMAR",
    clave,
    titulo: noRealizada ? `Reprogramar visita · ${e.numero}` : `Programar visita técnica · ${e.numero}`,
    mensaje: noRealizada
      ? `La última visita del trámite ${e.tramiteTipo.nombre} no se pudo realizar y está en el paso ${paso.numero} (${paso.titulo.toLowerCase()}). Debe reprogramarse.`
      : `El trámite ${e.tramiteTipo.nombre} llegó al paso ${paso.numero} (${paso.titulo.toLowerCase()}) y requiere visita técnica. Asigne el personal y programe la visita.`,
    enlace: `/expedientes/${e.id}#planeador`,
    expedienteId: e.id,
  });
}

async function sincronizarAvisoConcepto(
  e: { id: string; numero: string; estado: string; archivado: boolean; tramiteTipo: { nombre: string }; usuariosAsignados: { id: string }[] },
  paso: { numero: number; titulo: string; descripcion: string; esDecision: boolean; tipoActividad: TipoActividadPaso | null } | undefined
) {
  const prefijo = `concepto-por-elaborar:${e.id}:`;
  if (!paso || !expedienteEnEjecucion(e) || tipoActividadEfectivo(paso) !== "CONCEPTO_TECNICO" || e.usuariosAsignados.length === 0) {
    await resolverNotificaciones({ claveEmpiezaPor: prefijo });
    return;
  }
  const clave = `${prefijo}${paso.numero}`;
  await resolverNotificaciones({ claveEmpiezaPor: prefijo, excepto: clave });
  await db.notificacion.updateMany({
    where: { clave, resueltaEn: null, usuarioId: { notIn: e.usuariosAsignados.map((u) => u.id) } },
    data: { resueltaEn: new Date() },
  });
  const yaAvisados = await db.notificacion.findMany({ where: { clave, resueltaEn: null }, select: { usuarioId: true } });
  const nuevos = e.usuariosAsignados.filter((u) => !yaAvisados.some((n) => n.usuarioId === u.id));
  if (nuevos.length === 0) return;
  await notificar(
    nuevos.map((u) => u.id),
    {
      tipo: "CONCEPTO_POR_ELABORAR",
      clave,
      titulo: `Elaborar concepto técnico · ${e.numero}`,
      mensaje: `El trámite ${e.tramiteTipo.nombre} llegó al paso ${paso.numero} (${paso.titulo.toLowerCase()}). Le corresponde elaborar el concepto técnico.`,
      enlace: `/expedientes/${e.id}`,
      expedienteId: e.id,
    }
  );
}

const TEXTO_AVISO_PROFESIONAL: Record<"VISITA_PROGRAMADA" | "VISITA_REPROGRAMADA" | "VISITA_CANCELADA", { titulo: string; verbo: string }> = {
  VISITA_PROGRAMADA: { titulo: "Visita técnica asignada", verbo: "Se le programó la visita técnica" },
  VISITA_REPROGRAMADA: { titulo: "Visita técnica reprogramada", verbo: "Se reprogramó su visita técnica" },
  VISITA_CANCELADA: { titulo: "Visita técnica cancelada", verbo: "Se canceló su visita técnica" },
};

export async function avisarProfesionalVisita(
  visitaId: string,
  tipo: "VISITA_PROGRAMADA" | "VISITA_REPROGRAMADA" | "VISITA_CANCELADA",
  actorId: string
) {
  const v = await db.visitaProgramada.findUnique({
    where: { id: visitaId },
    select: {
      id: true,
      profesionalId: true,
      fechaHora: true,
      fechaHoraFin: true,
      lugar: true,
      motivoCambio: true,
      participantes: { select: { usuarioId: true } },
      expediente: { select: { id: true, numero: true, tramiteTipo: { select: { nombre: true } } } },
    },
  });
  if (!v) return;
  const clave = `visita:${v.id}`;
  const equipo = v.participantes.map((p) => p.usuarioId).filter((u) => u !== v.profesionalId && u !== actorId);
  if (equipo.length > 0) {
    const texto = TEXTO_AVISO_PROFESIONAL[tipo];
    await notificar(equipo, {
      tipo,
      clave: `equipo-visita:${v.id}`,
      titulo: `${texto.titulo} · ${v.expediente.numero}`,
      mensaje: `Visita del equipo en que participa (${v.expediente.tramiteTipo.nombre}): ${rangoTexto(v.fechaHora, v.fechaHoraFin)}, ${v.lugar}.${
        tipo === "VISITA_CANCELADA" && v.motivoCambio ? ` Motivo: ${v.motivoCambio}` : ""
      }`,
      enlace: tipo === "VISITA_CANCELADA" ? `/planeador` : `/expedientes/${v.expediente.id}/visitas/${v.id}`,
      expedienteId: v.expediente.id,
    });
  }
  if (v.profesionalId === actorId) {
    await resolverNotificaciones({ clave });
    return;
  }
  const texto = TEXTO_AVISO_PROFESIONAL[tipo];
  await notificar([v.profesionalId], {
    tipo,
    clave,
    titulo: `${texto.titulo} · ${v.expediente.numero}`,
    mensaje: `${texto.verbo} del trámite ${v.expediente.tramiteTipo.nombre}: ${rangoTexto(v.fechaHora, v.fechaHoraFin)}, ${v.lugar}.${
      tipo === "VISITA_CANCELADA" && v.motivoCambio ? ` Motivo: ${v.motivoCambio}` : ""
    }`,
    enlace: tipo === "VISITA_CANCELADA" ? `/expedientes/${v.expediente.id}#planeador` : `/expedientes/${v.expediente.id}/visitas/${v.id}`,
    expedienteId: v.expediente.id,
  });
}

export async function contarNoLeidas(usuarioId: string): Promise<number> {
  return db.notificacion.count({ where: { usuarioId, leidaEn: null, resueltaEn: null } });
}

export async function avisarConceptoVisita(solicitudId: string, actorId: string, rechazo?: string): Promise<void> {
  const s = await db.solicitudFirma.findUnique({ where: { id: solicitudId }, select: { documentoExpedienteId: true } });
  if (!s?.documentoExpedienteId) return;
  const vt = await db.visitaTecnica.findUnique({
    where: { documentoConceptoId: s.documentoExpedienteId },
    select: {
      conceptoNumero: true,
      finalizadaPorId: true,
      expedienteId: true,
      expediente: { select: { numero: true } },
      visitaProgramada: { select: { id: true, profesionalId: true, participantes: { where: { rol: "ELABORA" }, select: { usuarioId: true } } } },
      documentoConcepto: { select: { solicitudesFirma: { where: { rol: { not: "LECTURA" } }, select: { estado: true } } } },
    },
  });
  const v = vt?.visitaProgramada;
  if (!vt || !v) return;
  const destinatarios = [v.profesionalId, ...v.participantes.map((p) => p.usuarioId), ...(vt.finalizadaPorId ? [vt.finalizadaPorId] : [])].filter((u) => u !== actorId);
  const base = { clave: `concepto:${v.id}`, enlace: `/expedientes/${vt.expedienteId}/visitas/${v.id}/formato`, expedienteId: vt.expedienteId };
  if (rechazo !== undefined) {
    await notificar(destinatarios, {
      ...base,
      tipo: "CONCEPTO_RECHAZADO",
      titulo: `Concepto ${vt.conceptoNumero} rechazado · ${vt.expediente.numero}`,
      mensaje: `Se rechazó la firma del concepto técnico: ${rechazo} Quien planea las visitas puede reabrirlo para corrección.`,
    });
    return;
  }
  const firmas = vt.documentoConcepto?.solicitudesFirma ?? [];
  if (firmas.length === 0 || firmas.some((f) => f.estado !== "COMPLETADA")) return;
  await notificar(destinatarios, {
    ...base,
    tipo: "CONCEPTO_FIRMADO",
    titulo: `Concepto ${vt.conceptoNumero} firmado · ${vt.expediente.numero}`,
    mensaje: "Todas las personas del equipo firmaron o dieron visto bueno al concepto técnico.",
  });
}
