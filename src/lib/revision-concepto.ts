import type { AccionRevisionConcepto, EstadoRevisionConcepto } from "@prisma/client";
import { db } from "@/lib/db";
import { notificar, planificadoresConAcceso, resolverNotificaciones } from "@/lib/notificaciones";
import type { PermisosUsuario } from "@/lib/permisos";

export type EtapaConcepto = "REGISTRADO" | "EN_REVISION" | "DEVUELTO" | "EN_FIRMA" | "FIRMADO";

export const ETAPAS_CONCEPTO: { clave: EtapaConcepto; etiqueta: string }[] = [
  { clave: "REGISTRADO", etiqueta: "Registrado" },
  { clave: "EN_REVISION", etiqueta: "En revisión" },
  { clave: "EN_FIRMA", etiqueta: "En firma" },
  { clave: "FIRMADO", etiqueta: "Firmado" },
];

export const ETIQUETA_ACCION_REVISION: Record<AccionRevisionConcepto, string> = {
  ENVIO: "Envió a revisión",
  DEVOLUCION: "Devolvió con observaciones",
  APROBACION: "Aprobó y envió a firma",
  REAPERTURA: "Reabrió para corrección",
};

export function etapaConcepto(c: { estadoRevision: EstadoRevisionConcepto; finalizadaEn: Date | null; firmado: boolean }): EtapaConcepto {
  if (c.finalizadaEn) return c.firmado ? "FIRMADO" : "EN_FIRMA";
  if (c.estadoRevision === "EN_REVISION") return "EN_REVISION";
  if (c.estadoRevision === "DEVUELTO") return "DEVUELTO";
  return "REGISTRADO";
}

export function puedeEnviarARevision(estado: EstadoRevisionConcepto, finalizada: boolean): boolean {
  return !finalizada && (estado === "BORRADOR" || estado === "DEVUELTO");
}

export function puedeFinalizarSegunRevision(estado: EstadoRevisionConcepto): boolean {
  return estado !== "DEVUELTO";
}

async function datosVisita(visitaId: string) {
  return db.visitaProgramada.findUnique({
    where: { id: visitaId },
    select: {
      id: true,
      profesionalId: true,
      expedienteId: true,
      participantes: { where: { rol: "ELABORA" }, select: { usuarioId: true } },
      expediente: { select: { numero: true, tramiteTipoId: true, archivado: true } },
      visitaTecnica: { select: { id: true, estadoRevision: true, finalizadaEn: true, formatoVersionId: true, pasoNumero: true } },
    },
  });
}

function elaboradores(v: { profesionalId: string; participantes: { usuarioId: string }[] }): string[] {
  return [...new Set([v.profesionalId, ...v.participantes.map((p) => p.usuarioId)])];
}

export async function registrarRevision(visitaTecnicaId: string, accion: AccionRevisionConcepto, usuarioId: string, comentario: string | null) {
  await db.revisionConcepto.create({ data: { visitaTecnicaId, accion, usuarioId, comentario } });
}

export async function enviarConceptoARevision(visitaId: string, usuario: { id: string; nombre: string }, planificador: boolean, comentario: string | null) {
  const v = await datosVisita(visitaId);
  const vt = v?.visitaTecnica;
  if (!v || !vt) throw new Error("La visita no tiene hoja registrada.");
  if (!vt.formatoVersionId) throw new Error("La visita no se diligenció con un formato.");
  if (v.expediente.archivado) throw new Error("El expediente está cerrado y archivado.");
  if (!planificador && !elaboradores(v).includes(usuario.id)) throw new Error("Solo quien elabora el concepto puede enviarlo a revisión.");
  if (!puedeEnviarARevision(vt.estadoRevision, Boolean(vt.finalizadaEn))) throw new Error("El concepto ya está en revisión o en firma.");
  await db.$transaction([
    db.visitaTecnica.update({ where: { id: vt.id }, data: { estadoRevision: "EN_REVISION" } }),
    db.revisionConcepto.create({ data: { visitaTecnicaId: vt.id, accion: "ENVIO", usuarioId: usuario.id, comentario } }),
    db.expedienteEvento.create({
      data: {
        expedienteId: v.expedienteId,
        tipo: "VISITA_REGISTRADA",
        pasoNumero: vt.pasoNumero,
        descripcion: `${usuario.nombre} envió el concepto técnico a revisión.${comentario ? ` ${comentario}` : ""}`,
        usuarioId: usuario.id,
      },
    }),
  ]);
  await resolverNotificaciones({ clave: `concepto-devuelto:${visitaId}` });
  const revisores = (await planificadoresConAcceso(v.expediente.tramiteTipoId)).filter((u) => u !== usuario.id);
  await notificar(revisores, {
    tipo: "CONCEPTO_EN_REVISION",
    clave: `concepto-revision:${visitaId}`,
    titulo: `Concepto por revisar · ${v.expediente.numero}`,
    mensaje: `${usuario.nombre} envió el concepto técnico a revisión. Apruébelo y envíelo a firma, o devuélvalo con observaciones.`,
    enlace: `/expedientes/${v.expedienteId}/visitas/${visitaId}/formato`,
    expedienteId: v.expedienteId,
  });
}

export async function devolverConcepto(visitaId: string, usuario: { id: string; nombre: string }, comentario: string) {
  const texto = comentario.trim();
  if (!texto) throw new Error("Escriba las observaciones para quien elabora el concepto.");
  const v = await datosVisita(visitaId);
  const vt = v?.visitaTecnica;
  if (!v || !vt) throw new Error("La visita no tiene hoja registrada.");
  if (vt.finalizadaEn) throw new Error("El concepto ya está en firma; para corregirlo use «Reabrir para corrección».");
  if (vt.estadoRevision !== "EN_REVISION") throw new Error("El concepto no está en revisión.");
  await db.$transaction([
    db.visitaTecnica.update({ where: { id: vt.id }, data: { estadoRevision: "DEVUELTO" } }),
    db.revisionConcepto.create({ data: { visitaTecnicaId: vt.id, accion: "DEVOLUCION", usuarioId: usuario.id, comentario: texto } }),
    db.expedienteEvento.create({
      data: {
        expedienteId: v.expedienteId,
        tipo: "VISITA_REGISTRADA",
        pasoNumero: vt.pasoNumero,
        descripcion: `${usuario.nombre} devolvió el concepto técnico con observaciones: ${texto}`,
        usuarioId: usuario.id,
      },
    }),
  ]);
  await resolverNotificaciones({ clave: `concepto-revision:${visitaId}` });
  await notificar(
    elaboradores(v).filter((u) => u !== usuario.id),
    {
      tipo: "CONCEPTO_DEVUELTO",
      clave: `concepto-devuelto:${visitaId}`,
      titulo: `Concepto devuelto · ${v.expediente.numero}`,
      mensaje: `${usuario.nombre} devolvió el concepto técnico: ${texto}`,
      enlace: `/expedientes/${v.expedienteId}/visitas/${visitaId}/formato`,
      expedienteId: v.expedienteId,
    }
  );
}

export async function conceptosPorRevisar(permisos: PermisosUsuario) {
  return db.visitaTecnica.findMany({
    where: {
      estadoRevision: "EN_REVISION",
      finalizadaEn: null,
      visitaProgramadaId: { not: null },
      ...(permisos.esAdmin ? {} : { expediente: { tramiteTipoId: { in: [...permisos.tramites.keys()] } } }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      visitaProgramadaId: true,
      conceptoNumero: true,
      expediente: { select: { id: true, numero: true, tramiteTipo: { select: { nombre: true } } } },
      visitaProgramada: { select: { lugar: true, profesional: { select: { nombre: true } } } },
      revisiones: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, usuario: { select: { nombre: true } } } },
    },
  });
}

export async function conceptosDevueltosA(usuarioId: string) {
  return db.visitaTecnica.findMany({
    where: {
      estadoRevision: "DEVUELTO",
      finalizadaEn: null,
      visitaProgramada: { OR: [{ profesionalId: usuarioId }, { participantes: { some: { usuarioId, rol: "ELABORA" } } }] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      visitaProgramadaId: true,
      conceptoNumero: true,
      expediente: { select: { id: true, numero: true, tramiteTipo: { select: { nombre: true } } } },
      visitaProgramada: { select: { lugar: true, profesional: { select: { nombre: true } } } },
      revisiones: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, comentario: true, usuario: { select: { nombre: true } } } },
    },
  });
}
