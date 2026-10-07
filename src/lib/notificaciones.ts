import type { TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";
import { CARGOS_PLANEADOR } from "@/lib/permisos";
import { expedienteEnEjecucion } from "@/lib/planeador";
import { pasoPermiteVisita } from "@/lib/temas-visita";
import { rangoTexto } from "@/lib/planeador-db";

type DatosNotificacion = { tipo: TipoNotificacion; clave: string; titulo: string; mensaje: string; enlace: string; expedienteId?: string };

export async function notificar(usuarioIds: string[], datos: DatosNotificacion) {
  const destinatarios = [...new Set(usuarioIds)];
  if (destinatarios.length === 0) return;
  await db.$transaction(
    destinatarios.map((usuarioId) =>
      db.notificacion.upsert({
        where: { usuarioId_clave: { usuarioId, clave: datos.clave } },
        create: { usuarioId, ...datos },
        update: { tipo: datos.tipo, titulo: datos.titulo, mensaje: datos.mensaje, enlace: datos.enlace, leidaEn: null, resueltaEn: null },
      })
    )
  );
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
      cargos: { some: { nombre: { in: CARGOS_PLANEADOR } } },
      OR: [{ rol: "ADMIN" }, { tramitesAcceso: { some: { tramiteTipoId } } }],
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
      flujo: { select: { pasos: { select: { numero: true, titulo: true, descripcion: true } } } },
      visitasProgramadas: { select: { estado: true, fechaHora: true }, orderBy: { fechaHora: "desc" } },
      visitasTecnicas: { select: { pasoNumero: true } },
    },
  });
  if (!e) return;

  const prefijo = `visita-sin-programar:${e.id}:`;
  const clave = `${prefijo}${e.pasoActualNumero}`;
  const paso = e.flujo.pasos.find((p) => p.numero === e.pasoActualNumero);
  const requiere =
    expedienteEnEjecucion(e) &&
    !!paso &&
    pasoPermiteVisita(paso.titulo, paso.descripcion) &&
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
      expediente: { select: { id: true, numero: true, tramiteTipo: { select: { nombre: true } } } },
    },
  });
  if (!v) return;
  const clave = `visita:${v.id}`;
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
