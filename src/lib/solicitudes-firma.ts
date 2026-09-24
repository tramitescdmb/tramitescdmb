import { db } from "@/lib/db";
import { resolverFirma } from "@/lib/firma-proveedor";
import { hashContenidoFirma } from "@/lib/firma";
import type { RolFirmante, EstadoSolicitudFirma } from "@prisma/client";
import crypto from "crypto";

export type ObjetivoSolicitud =
  | { tipo: "comunicacion"; id: string }
  | { tipo: "documentoContrato"; id: string }
  | { tipo: "documentoExpediente"; id: string };

function whereObjetivo(objetivo: ObjetivoSolicitud) {
  if (objetivo.tipo === "comunicacion") return { comunicacionId: objetivo.id };
  if (objetivo.tipo === "documentoContrato") return { documentoContratoId: objetivo.id };
  return { documentoExpedienteId: objetivo.id };
}

const MAX_FIRMANTES_POR_OBJETIVO = 4;

export async function asignarFirmantes(
  objetivo: ObjetivoSolicitud,
  asignadoPorId: string,
  firmantes: { usuarioId: string; rol: RolFirmante; orden?: number }[]
) {
  if (firmantes.length === 0) throw new Error("Debe indicar al menos una persona.");

  if (firmantes.some((f) => f.rol === "FIRMA")) {
    if (objetivo.tipo === "documentoContrato") {
      const doc = await db.documentoContrato.findUnique({
        where: { id: objetivo.id },
        select: { requiereFirma: true, firmadoEnSecop: true },
      });
      if (!doc) throw new Error("El documento no existe.");
      if (!doc.requiereFirma) throw new Error("Este documento no está marcado como que requiere firma electrónica.");
      if (doc.firmadoEnSecop) throw new Error("Este documento ya viene firmado/publicado en SECOP II — no requiere firma interna.");
    } else if (objetivo.tipo === "documentoExpediente") {
      const doc = await db.expedienteDocumento.findUnique({ where: { id: objetivo.id }, select: { requiereFirma: true } });
      if (!doc) throw new Error("El documento no existe.");
      if (!doc.requiereFirma) throw new Error("Este documento no está marcado como que requiere firma electrónica.");
    } else {
      const c = await db.comunicacion.findUnique({ where: { id: objetivo.id }, select: { tipo: true, estado: true } });
      if (!c) throw new Error("La comunicación no existe.");
      if (c.tipo === "RECIBIDA") throw new Error("Una comunicación recibida no se firma: no tiene un contenido redactado por la Corporación.");
      if (c.estado === "ANULADA") throw new Error("No se puede firmar una comunicación anulada.");
    }

    const firmantesExistentes = await db.solicitudFirma.count({
      where: { ...whereObjetivo(objetivo), rol: "FIRMA", estado: { not: "RECHAZADA" } },
    });
    const nuevosFirma = firmantes.filter((f) => f.rol === "FIRMA").length;
    if (firmantesExistentes + nuevosFirma > MAX_FIRMANTES_POR_OBJETIVO) {
      throw new Error(`Máximo ${MAX_FIRMANTES_POR_OBJETIVO} firmantes por documento (ya hay ${firmantesExistentes}).`);
    }
  }

  const data = firmantes.map((f) => ({
    ...whereObjetivo(objetivo),
    usuarioAsignadoId: f.usuarioId,
    rol: f.rol,
    orden: f.orden ?? 1,
    asignadoPorId,
    estado: (f.rol === "LECTURA" ? "COMPLETADA" : "PENDIENTE") as EstadoSolicitudFirma,
    completadoEn: f.rol === "LECTURA" ? new Date() : null,
  }));
  await db.solicitudFirma.createMany({ data });
}

export function puedeActuarSolicitud(
  todas: { rol: RolFirmante; orden: number; estado: EstadoSolicitudFirma }[],
  solicitud: { rol: RolFirmante; orden: number }
): boolean {
  const bloqueantesPendientes = todas.filter(
    (s) => s.rol === "FIRMA" && s.orden < solicitud.orden && s.estado === "PENDIENTE"
  );
  return bloqueantesPendientes.length === 0;
}

async function reevaluarEstadoDocumentoContrato(documentoId: string, usuarioId: string) {
  const solicitudes = await db.solicitudFirma.findMany({ where: { documentoContratoId: documentoId, rol: "FIRMA" } });
  if (solicitudes.length === 0) {
    await db.documentoContrato.update({
      where: { id: documentoId },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    });
    return;
  }
  if (solicitudes.some((s) => s.estado === "RECHAZADA")) {
    await db.documentoContrato.update({ where: { id: documentoId }, data: { estadoValidacion: "RECHAZADO" } });
  } else if (solicitudes.every((s) => s.estado === "COMPLETADA")) {
    await db.documentoContrato.update({
      where: { id: documentoId },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    });
  }
}

async function reevaluarEstadoDocumentoExpediente(documentoId: string, usuarioId: string) {
  const solicitudes = await db.solicitudFirma.findMany({ where: { documentoExpedienteId: documentoId, rol: "FIRMA" } });
  if (solicitudes.length === 0) {
    await db.expedienteDocumento.update({
      where: { id: documentoId },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    });
    return;
  }
  if (solicitudes.some((s) => s.estado === "RECHAZADA")) {
    await db.expedienteDocumento.update({ where: { id: documentoId }, data: { estadoValidacion: "RECHAZADO" } });
  } else if (solicitudes.every((s) => s.estado === "COMPLETADA")) {
    await db.expedienteDocumento.update({
      where: { id: documentoId },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    });
  }
}

function hashContenidoFirmaDocumento(datos: { documentoId: string; nombre: string; hashSha256: string | null; fechaIso: string }): string {
  const base = [datos.documentoId, datos.nombre, datos.hashSha256 ?? "", datos.fechaIso].join("␟");
  return crypto.createHash("sha256").update(base, "utf8").digest("hex");
}

export async function completarSolicitudFirma(
  solicitudId: string,
  usuarioId: string,
  ip: string | null,
  userAgent: string | null
) {
  const solicitud = await db.solicitudFirma.findUnique({
    where: { id: solicitudId },
    include: { documentoContrato: true, documentoExpediente: true, comunicacion: true },
  });
  if (!solicitud) throw new Error("La solicitud no existe.");
  if (solicitud.usuarioAsignadoId !== usuarioId) throw new Error("Esta solicitud no está asignada a usted.");
  if (solicitud.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");
  if (solicitud.rol === "LECTURA") throw new Error("Un acceso de solo lectura no requiere ninguna acción.");

  const hermanas = await db.solicitudFirma.findMany({
    where: solicitud.comunicacionId
      ? { comunicacionId: solicitud.comunicacionId }
      : solicitud.documentoContratoId
        ? { documentoContratoId: solicitud.documentoContratoId }
        : { documentoExpedienteId: solicitud.documentoExpedienteId! },
  });
  if (!puedeActuarSolicitud(hermanas, solicitud)) {
    throw new Error("Debe(n) resolver primero quien(es) tiene(n) un turno anterior.");
  }

  if (solicitud.rol === "VISTO_BUENO") {
    await db.solicitudFirma.update({ where: { id: solicitudId }, data: { estado: "COMPLETADA", completadoEn: new Date(), ip, userAgent } });
    return;
  }

  if (solicitud.documentoContrato) {
    const doc = solicitud.documentoContrato;
    const firmasPrevias = await db.firmaDocumentoContrato.findMany({ where: { documentoId: doc.id }, select: { usuarioId: true } });
    if (firmasPrevias.some((f) => f.usuarioId === usuarioId)) throw new Error("Usted ya firmó este documento.");

    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const firma = await db.firmaDocumentoContrato.create({
      data: {
        documentoId: doc.id,
        usuarioId,
        hashContenido,
        ip,
        userAgent,
        proveedor: resuelto.proveedor,
        formato: resuelto.formato,
        selloTiempoEn: resuelto.selloTiempoEn,
        selloTiempoFuente: resuelto.selloTiempoFuente,
        selloTiempoToken: resuelto.selloTiempoToken,
      },
    });
    await db.solicitudFirma.update({
      where: { id: solicitudId },
      data: { estado: "COMPLETADA", completadoEn: new Date(), firmaDocContratoId: firma.id, ip, userAgent },
    });
    await reevaluarEstadoDocumentoContrato(doc.id, usuarioId);
    await db.eventoContratacion.create({
      data: { expedienteId: doc.expedienteId, tipo: "DOCUMENTO_FIRMADO", detalle: `Se firmó "${doc.nombre}"`, usuarioId },
    });
  } else if (solicitud.documentoExpediente) {
    const doc = solicitud.documentoExpediente;
    const firmasPrevias = await db.firmaExpedienteDocumento.findMany({ where: { documentoId: doc.id }, select: { usuarioId: true } });
    if (firmasPrevias.some((f) => f.usuarioId === usuarioId)) throw new Error("Usted ya firmó este documento.");

    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const firma = await db.firmaExpedienteDocumento.create({
      data: {
        documentoId: doc.id,
        usuarioId,
        hashContenido,
        ip,
        userAgent,
        proveedor: resuelto.proveedor,
        formato: resuelto.formato,
        selloTiempoEn: resuelto.selloTiempoEn,
        selloTiempoFuente: resuelto.selloTiempoFuente,
        selloTiempoToken: resuelto.selloTiempoToken,
      },
    });
    await db.solicitudFirma.update({
      where: { id: solicitudId },
      data: { estado: "COMPLETADA", completadoEn: new Date(), firmaExpedienteId: firma.id, ip, userAgent },
    });
    await reevaluarEstadoDocumentoExpediente(doc.id, usuarioId);
    await db.expedienteEvento.create({
      data: {
        expedienteId: doc.expedienteId,
        tipo: "DOCUMENTO_FIRMADO",
        descripcion: `Se firmó "${doc.nombre}".`,
        pasoNumero: doc.pasoNumero,
        usuarioId,
      },
    });
  } else if (solicitud.comunicacion) {
    const c = solicitud.comunicacion;
    if (c.estado === "ANULADA") throw new Error("No se puede firmar una comunicación anulada.");
    const firmasPrevias = await db.firma.findMany({ where: { comunicacionId: c.id }, select: { usuarioId: true } });
    if (firmasPrevias.some((f) => f.usuarioId === usuarioId)) throw new Error("Usted ya firmó esta comunicación.");

    const fechaHora = new Date();
    const hashContenido = hashContenidoFirma({ radicado: c.radicado, asunto: c.asunto, contenido: c.contenido, fechaIso: fechaHora.toISOString() });
    const resuelto = await resolverFirma(hashContenido);
    const firma = await db.firma.create({
      data: {
        usuarioId,
        comunicacionId: c.id,
        fechaHora,
        hashContenido,
        tipo: "ELECTRONICA_HASH",
        ip,
        userAgent,
        proveedor: resuelto.proveedor,
        formato: resuelto.formato,
        selloTiempoEn: resuelto.selloTiempoEn,
        selloTiempoFuente: resuelto.selloTiempoFuente,
        selloTiempoToken: resuelto.selloTiempoToken,
      },
    });
    await db.solicitudFirma.update({
      where: { id: solicitudId },
      data: { estado: "COMPLETADA", completadoEn: new Date(), firmaId: firma.id, ip, userAgent },
    });
  }
}

export async function rechazarSolicitudFirma(solicitudId: string, usuarioId: string, comentario: string) {
  if (!comentario.trim()) throw new Error("Indique el motivo del rechazo.");
  const solicitud = await db.solicitudFirma.findUnique({
    where: { id: solicitudId },
    include: {
      documentoContrato: { select: { id: true, nombre: true, expedienteId: true, subidoPorId: true } },
      documentoExpediente: { select: { id: true, nombre: true, expedienteId: true, pasoNumero: true, subidoPorId: true } },
    },
  });
  if (!solicitud) throw new Error("La solicitud no existe.");
  if (solicitud.usuarioAsignadoId !== usuarioId) throw new Error("Esta solicitud no está asignada a usted.");
  if (solicitud.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");

  await db.solicitudFirma.update({
    where: { id: solicitudId },
    data: { estado: "RECHAZADA", comentario: comentario.trim(), completadoEn: new Date() },
  });

  if (solicitud.documentoContrato) {
    await reevaluarEstadoDocumentoContrato(solicitud.documentoContrato.id, usuarioId);
    await db.eventoContratacion.create({
      data: {
        expedienteId: solicitud.documentoContrato.expedienteId,
        tipo: "DOCUMENTO_RECHAZADO",
        detalle: `Se rechazó la firma de "${solicitud.documentoContrato.nombre}": ${comentario.trim()}`,
        usuarioId,
      },
    });
    await db.avisoRechazoDocumento.create({
      data: {
        expedienteId: solicitud.documentoContrato.expedienteId,
        documentoContratoId: solicitud.documentoContrato.id,
        mensaje: comentario.trim(),
        rechazadoPorId: usuarioId,
        subidoPorId: solicitud.documentoContrato.subidoPorId,
      },
    });
  } else if (solicitud.documentoExpediente) {
    const doc = solicitud.documentoExpediente;
    await reevaluarEstadoDocumentoExpediente(doc.id, usuarioId);
    await db.expedienteEvento.create({
      data: {
        expedienteId: doc.expedienteId,
        tipo: "DOCUMENTO_RECHAZADO",
        descripcion: `Se rechazó la firma de "${doc.nombre}": ${comentario.trim()}`,
        pasoNumero: doc.pasoNumero,
        usuarioId,
      },
    });
    await db.avisoRechazoDocumento.create({
      data: {
        expedienteTramiteId: doc.expedienteId,
        documentoExpedienteId: doc.id,
        mensaje: comentario.trim(),
        rechazadoPorId: usuarioId,
        subidoPorId: doc.subidoPorId,
      },
    });
  }
}

export type SolicitudBuzon = {
  id: string;
  rol: RolFirmante;
  orden: number;
  estado: EstadoSolicitudFirma;
  asignadoEn: Date;
  puedeActuar: boolean;
  asignadoPor: { nombre: string };
};

export async function contarPendientesBuzonContratacion(usuarioId: string): Promise<{ total: number; listos: number }> {
  const solicitudes = await listarBuzon(usuarioId, "documentoContrato");
  const accionables = solicitudes.filter((s) => s.rol === "FIRMA" || s.rol === "VISTO_BUENO");
  return { total: accionables.length, listos: accionables.filter((s) => s.puedeActuar).length };
}

export async function contarPendientesBuzonTramite(usuarioId: string): Promise<{ total: number; listos: number }> {
  const solicitudes = await listarBuzon(usuarioId, "documentoExpediente");
  const accionables = solicitudes.filter((s) => s.rol === "FIRMA" || s.rol === "VISTO_BUENO");
  return { total: accionables.length, listos: accionables.filter((s) => s.puedeActuar).length };
}

export async function listarBuzon(usuarioId: string, tipo: "comunicacion" | "documentoContrato" | "documentoExpediente") {
  const filtroTipo =
    tipo === "comunicacion"
      ? { comunicacionId: { not: null } }
      : tipo === "documentoContrato"
        ? { documentoContratoId: { not: null } }
        : { documentoExpedienteId: { not: null } };

  const solicitudes = await db.solicitudFirma.findMany({
    where: { usuarioAsignadoId: usuarioId, estado: "PENDIENTE", ...filtroTipo },
    include: {
      asignadoPor: { select: { nombre: true } },
      comunicacion: { select: { id: true, radicado: true, asunto: true } },
      documentoContrato: {
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          expedienteId: true,
          expediente: { select: { numero: true } },
          firmas: { select: { id: true } },
        },
      },
      documentoExpediente: {
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          expedienteId: true,
          expediente: { select: { numero: true } },
          firmas: { select: { id: true } },
        },
      },
    },
    orderBy: { asignadoEn: "asc" },
  });

  const idsObjetivo = solicitudes.map((s) => s.comunicacionId ?? s.documentoContratoId ?? s.documentoExpedienteId!);
  const hermanasPorObjetivo = new Map<string, { rol: RolFirmante; orden: number; estado: EstadoSolicitudFirma }[]>();
  if (idsObjetivo.length > 0) {
    const hermanas = await db.solicitudFirma.findMany({
      where: filtroTipo.comunicacionId
        ? { comunicacionId: { in: idsObjetivo } }
        : filtroTipo.documentoContratoId
          ? { documentoContratoId: { in: idsObjetivo } }
          : { documentoExpedienteId: { in: idsObjetivo } },
      select: { comunicacionId: true, documentoContratoId: true, documentoExpedienteId: true, rol: true, orden: true, estado: true },
    });
    for (const h of hermanas) {
      const clave = h.comunicacionId ?? h.documentoContratoId ?? h.documentoExpedienteId!;
      if (!hermanasPorObjetivo.has(clave)) hermanasPorObjetivo.set(clave, []);
      hermanasPorObjetivo.get(clave)!.push(h);
    }
  }

  return solicitudes.map((s) => {
    const clave = s.comunicacionId ?? s.documentoContratoId ?? s.documentoExpedienteId!;
    return {
      ...s,
      puedeActuar: puedeActuarSolicitud(hermanasPorObjetivo.get(clave) ?? [], s),
    };
  });
}
