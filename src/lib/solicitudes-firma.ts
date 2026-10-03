import { db } from "@/lib/db";
import { resolverFirma } from "@/lib/firma-proveedor";
import type { RolFirmante, EstadoSolicitudFirma, CalidadFirma } from "@prisma/client";
import crypto from "crypto";
import { estadoPorFirmas } from "@/lib/estado-firmas";
import { resumirPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";
import { nivelFirma, puedeSerFirmantePrincipal, puedeSolicitarFirmas, type ModuloFirma } from "@/lib/jerarquia-firma";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { hashFirmaComunicacion, validarComunicacionFirmable, SELECT_COMUNICACION_FIRMABLE } from "@/lib/firma-comunicacion";

export type ObjetivoSolicitud =
  | { tipo: "comunicacion"; id: string }
  | { tipo: "documentoContrato"; id: string }
  | { tipo: "documentoExpediente"; id: string }
  | { tipo: "documentoArchivo"; id: string };

export type TipoObjetivo = ObjetivoSolicitud["tipo"];

function entidadSgdea(objetivo: ObjetivoSolicitud): { entidad: "Comunicacion" | "DocumentoArchivo"; entidadId: string } | null {
  if (objetivo.tipo === "comunicacion") return { entidad: "Comunicacion", entidadId: objetivo.id };
  if (objetivo.tipo === "documentoArchivo") return { entidad: "DocumentoArchivo", entidadId: objetivo.id };
  return null;
}

function whereObjetivo(objetivo: ObjetivoSolicitud) {
  if (objetivo.tipo === "comunicacion") return { comunicacionId: objetivo.id };
  if (objetivo.tipo === "documentoContrato") return { documentoContratoId: objetivo.id };
  if (objetivo.tipo === "documentoArchivo") return { documentoArchivoId: objetivo.id };
  return { documentoExpedienteId: objetivo.id };
}

function claveObjetivo(s: { comunicacionId: string | null; documentoContratoId: string | null; documentoExpedienteId: string | null; documentoArchivoId: string | null }) {
  return s.comunicacionId ?? s.documentoContratoId ?? s.documentoExpedienteId ?? s.documentoArchivoId!;
}

export function moduloDeObjetivo(tipo: TipoObjetivo): ModuloFirma {
  if (tipo === "documentoContrato") return "GECON";
  if (tipo === "documentoExpediente") return "TRAMITES";
  return "SGDEA";
}

const MAX_FIRMANTES_POR_OBJETIVO = 4;

async function usuariosQueYaFirmaron(objetivo: ObjetivoSolicitud, usuarioIds: string[]): Promise<string[]> {
  const where = { usuarioId: { in: usuarioIds } };
  const select = { usuario: { select: { nombre: true } } };
  const filas =
    objetivo.tipo === "documentoExpediente"
      ? await db.firmaExpedienteDocumento.findMany({ where: { ...where, documentoId: objetivo.id }, select })
      : objetivo.tipo === "documentoContrato"
        ? await db.firmaDocumentoContrato.findMany({ where: { ...where, documentoId: objetivo.id }, select })
        : objetivo.tipo === "documentoArchivo"
          ? await db.firma.findMany({ where: { ...where, documentoArchivoId: objetivo.id }, select })
          : await db.firma.findMany({ where: { ...where, comunicacionId: objetivo.id }, select });
  return filas.map((f) => f.usuario.nombre);
}

export async function asignarFirmantes(
  objetivo: ObjetivoSolicitud,
  asignadoPorId: string,
  firmantes: { usuarioId: string; rol: RolFirmante; orden?: number; calidad?: CalidadFirma | null }[],
  ip: string | null = null,
  userAgent: string | null = null
) {
  if (firmantes.length === 0) throw new Error("Debe indicar al menos una persona.");

  const modulo = moduloDeObjetivo(objetivo.tipo);
  const selectPersona = { id: true, nombre: true, activo: true, denominacionEmpleo: true, rolContratacion: true } as const;
  const asignador = await db.usuario.findUnique({ where: { id: asignadoPorId }, select: selectPersona });
  if (!asignador) throw new Error("El usuario que asigna no existe.");
  if (!puedeSolicitarFirmas(asignador) && firmantes.some((f) => f.usuarioId !== asignadoPorId)) {
    throw new Error("Un contratista no puede solicitar a otra persona que firme o dé visto bueno.");
  }
  const personas = new Map(
    (await db.usuario.findMany({ where: { id: { in: firmantes.map((f) => f.usuarioId) } }, select: selectPersona })).map((u) => [u.id, u])
  );
  for (const f of firmantes) {
    const persona = personas.get(f.usuarioId);
    if (!persona || !persona.activo) throw new Error("Una de las personas seleccionadas no existe o está inactiva.");
    if (f.rol === "FIRMA" && (f.calidad ?? "PRINCIPAL") === "PRINCIPAL" && !puedeSerFirmantePrincipal(persona, modulo)) {
      throw new Error(`${persona.nombre} es contratista: solo puede firmar como Proyectó o Revisó, no como firmante principal.`);
    }
  }

  const conAccion = firmantes.filter((f) => f.rol !== "LECTURA");
  if (new Set(conAccion.map((f) => f.usuarioId)).size !== conAccion.length) {
    throw new Error("La misma persona aparece más de una vez en la asignación.");
  }
  if (conAccion.length > 0) {
    const ids = conAccion.map((f) => f.usuarioId);
    const activas = await db.solicitudFirma.findMany({
      where: { ...whereObjetivo(objetivo), usuarioAsignadoId: { in: ids }, rol: { not: "LECTURA" }, estado: { not: "RECHAZADA" } },
      select: { rol: true, estado: true, usuarioAsignado: { select: { nombre: true } } },
    });
    if (activas.length > 0) {
      const a = activas[0]!;
      const que = a.rol === "FIRMA" ? "la firma" : "el visto bueno";
      throw new Error(
        a.estado === "COMPLETADA"
          ? `${a.usuarioAsignado.nombre} ya completó ${que} de este documento.`
          : `${a.usuarioAsignado.nombre} ya tiene pendiente ${que} de este documento.`
      );
    }
    const firmaron = await usuariosQueYaFirmaron(objetivo, ids);
    if (firmaron.length > 0) throw new Error(`${firmaron[0]} ya firmó este documento.`);
  }

  if (firmantes.some((f) => f.rol === "FIRMA")) {
    if (objetivo.tipo === "documentoContrato") {
      const doc = await db.documentoContrato.findUnique({
        where: { id: objetivo.id },
        select: { requiereFirma: true, cargadoEnSecop: true },
      });
      if (!doc) throw new Error("El documento no existe.");
      if (!doc.requiereFirma) throw new Error("Este documento no está marcado como que requiere firma electrónica.");
      if (doc.cargadoEnSecop) throw new Error("Este documento ya fue cargado en SECOP II — no requiere firma interna.");
    } else if (objetivo.tipo === "documentoExpediente") {
      const doc = await db.expedienteDocumento.findUnique({ where: { id: objetivo.id }, select: { requiereFirma: true } });
      if (!doc) throw new Error("El documento no existe.");
      if (!doc.requiereFirma) throw new Error("Este documento no está marcado como que requiere firma electrónica.");
    } else if (objetivo.tipo === "documentoArchivo") {
      await validarDocumentoArchivoFirmable(objetivo.id);
    } else {
      const c = await db.comunicacion.findUnique({ where: { id: objetivo.id }, select: SELECT_COMUNICACION_FIRMABLE });
      if (!c) throw new Error("La comunicación no existe.");
      await validarComunicacionFirmable(c);
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
    orden: nivelFirma(personas.get(f.usuarioId)!),
    calidad: f.rol === "FIRMA" ? (f.calidad ?? "PRINCIPAL") : null,
    asignadoPorId,
    estado: (f.rol === "LECTURA" ? "COMPLETADA" : "PENDIENTE") as EstadoSolicitudFirma,
    completadoEn: f.rol === "LECTURA" ? new Date() : null,
  }));
  await db.solicitudFirma.createMany({ data });

  if (firmantes.some((f) => f.rol === "FIRMA")) {
    if (objetivo.tipo === "documentoContrato") await reevaluarEstadoDocumentoContrato(objetivo.id, asignadoPorId);
    else if (objetivo.tipo === "documentoExpediente") await reevaluarEstadoDocumentoExpediente(objetivo.id, asignadoPorId);
  }

  const nombres = firmantes.map((f) => personas.get(f.usuarioId)!.nombre);
  const ETIQUETA_ROL: Record<RolFirmante, string> = { FIRMA: "firmar", VISTO_BUENO: "dar visto bueno", LECTURA: "lectura" };
  const detalleAsignacion = `Asignó a ${nombres.join(", ")} (${[...new Set(firmantes.map((f) => ETIQUETA_ROL[f.rol]))].join(" / ")})`;

  const sgdea = entidadSgdea(objetivo);
  if (sgdea) {
    await registrarAuditoriaDoc({
      entidad: sgdea.entidad,
      entidadId: sgdea.entidadId,
      accion: "SOLICITA_FIRMA",
      usuarioId: asignadoPorId,
      ip,
      userAgent,
      detalle: detalleAsignacion,
    }).catch((e) => console.error("registrarAuditoriaDoc (asignarFirmantes) falló:", e));
  } else if (objetivo.tipo === "documentoContrato") {
    const doc = await db.documentoContrato.findUnique({ where: { id: objetivo.id }, select: { expedienteId: true } });
    if (doc) {
      await db.eventoContratacion.create({
        data: { expedienteId: doc.expedienteId, tipo: "FIRMA_SOLICITADA", detalle: detalleAsignacion, usuarioId: asignadoPorId },
      });
    }
  } else if (objetivo.tipo === "documentoExpediente") {
    const doc = await db.expedienteDocumento.findUnique({ where: { id: objetivo.id }, select: { expedienteId: true, pasoNumero: true } });
    if (doc) {
      await db.expedienteEvento.create({
        data: { expedienteId: doc.expedienteId, tipo: "FIRMA_SOLICITADA", descripcion: detalleAsignacion, pasoNumero: doc.pasoNumero, usuarioId: asignadoPorId },
      });
    }
  }
}

export async function validarDocumentoArchivoFirmable(documentoArchivoId: string) {
  const doc = await db.documentoArchivo.findUnique({
    where: { id: documentoArchivoId },
    select: { retiradoEn: true, expediente: { select: { estado: true } } },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.retiradoEn) throw new Error("Este documento fue retirado del expediente: no se puede firmar.");
  if (doc.expediente.estado !== "ABIERTO") throw new Error("El expediente está cerrado: sus documentos ya no se pueden firmar.");
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
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { estadoValidacion: true } });
  const estado = estadoPorFirmas(solicitudes);
  if (estado === "APROBADO") {
    await db.documentoContrato.update({ where: { id: documentoId }, data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() } });
  } else if (estado === "RECHAZADO") {
    await db.documentoContrato.update({ where: { id: documentoId }, data: { estadoValidacion: "RECHAZADO" } });
  } else if (doc?.estadoValidacion === "RECHAZADO") {
    await db.documentoContrato.update({ where: { id: documentoId }, data: { estadoValidacion: "PENDIENTE", validadoPorId: null, validadoEn: null } });
  }
}

async function reevaluarEstadoDocumentoExpediente(documentoId: string, usuarioId: string) {
  const solicitudes = await db.solicitudFirma.findMany({ where: { documentoExpedienteId: documentoId, rol: "FIRMA" } });
  const doc = await db.expedienteDocumento.findUnique({ where: { id: documentoId }, select: { estadoValidacion: true } });
  const estado = estadoPorFirmas(solicitudes);
  if (estado === "APROBADO") {
    await db.expedienteDocumento.update({ where: { id: documentoId }, data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() } });
  } else if (estado === "RECHAZADO") {
    await db.expedienteDocumento.update({ where: { id: documentoId }, data: { estadoValidacion: "RECHAZADO" } });
  } else if (doc?.estadoValidacion === "RECHAZADO") {
    await db.expedienteDocumento.update({ where: { id: documentoId }, data: { estadoValidacion: "PENDIENTE", validadoPorId: null, validadoEn: null } });
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
    include: { documentoContrato: true, documentoExpediente: true, comunicacion: true, documentoArchivo: true },
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
        : solicitud.documentoArchivoId
          ? { documentoArchivoId: solicitud.documentoArchivoId }
          : { documentoExpedienteId: solicitud.documentoExpedienteId! },
  });
  if (!puedeActuarSolicitud(hermanas, solicitud)) {
    throw new Error("Debe(n) resolver primero quien(es) tiene(n) un turno anterior.");
  }

  if (solicitud.rol === "VISTO_BUENO") {
    await db.solicitudFirma.update({ where: { id: solicitudId }, data: { estado: "COMPLETADA", completadoEn: new Date(), ip, userAgent } });
    const sgdea = solicitud.comunicacion
      ? { entidad: "Comunicacion" as const, entidadId: solicitud.comunicacion.id, ref: solicitud.comunicacion.radicado }
      : solicitud.documentoArchivo
        ? { entidad: "DocumentoArchivo" as const, entidadId: solicitud.documentoArchivo.id, ref: solicitud.documentoArchivo.nombre }
        : null;
    if (sgdea) {
      await registrarAuditoriaDoc({
        entidad: sgdea.entidad,
        entidadId: sgdea.entidadId,
        accion: "VISTO_BUENO",
        usuarioId,
        ip,
        userAgent,
        detalle: `Dio visto bueno sobre "${sgdea.ref}"`,
      }).catch((e) => console.error("registrarAuditoriaDoc (completarSolicitudFirma visto bueno) falló:", e));
    } else if (solicitud.documentoContrato) {
      const doc = solicitud.documentoContrato;
      await db.eventoContratacion.create({
        data: { expedienteId: doc.expedienteId, tipo: "VISTO_BUENO_DADO", detalle: `Dio visto bueno sobre "${doc.nombre}"`, usuarioId },
      });
    } else if (solicitud.documentoExpediente) {
      const doc = solicitud.documentoExpediente;
      await db.expedienteEvento.create({
        data: { expedienteId: doc.expedienteId, tipo: "VISTO_BUENO_DADO", descripcion: `Dio visto bueno sobre "${doc.nombre}".`, pasoNumero: doc.pasoNumero, usuarioId },
      });
    }
    return;
  }

  if (solicitud.documentoContrato) {
    const doc = solicitud.documentoContrato;
    const previa = await db.firmaDocumentoContrato.findFirst({ where: { documentoId: doc.id, usuarioId }, select: { id: true } });
    if (previa) {
      await db.solicitudFirma.update({ where: { id: solicitudId }, data: { estado: "COMPLETADA", completadoEn: new Date(), firmaDocContratoId: previa.id, ip, userAgent } });
      await reevaluarEstadoDocumentoContrato(doc.id, usuarioId);
      return;
    }

    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const firma = await db.firmaDocumentoContrato.create({
      data: {
        documentoId: doc.id,
        usuarioId,
        hashContenido,
        calidad: solicitud.calidad,
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
    const previa = await db.firmaExpedienteDocumento.findFirst({ where: { documentoId: doc.id, usuarioId }, select: { id: true } });
    if (previa) {
      await db.solicitudFirma.update({ where: { id: solicitudId }, data: { estado: "COMPLETADA", completadoEn: new Date(), firmaExpedienteId: previa.id, ip, userAgent } });
      await reevaluarEstadoDocumentoExpediente(doc.id, usuarioId);
      return;
    }

    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const firma = await db.firmaExpedienteDocumento.create({
      data: {
        documentoId: doc.id,
        usuarioId,
        hashContenido,
        calidad: solicitud.calidad,
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
    await validarComunicacionFirmable(c);
    let firmaId: string;
    const previa = await db.firma.findFirst({ where: { comunicacionId: c.id, usuarioId }, select: { id: true } });
    if (previa) {
      firmaId = previa.id;
    } else {
      const fechaHora = new Date();
      const hashContenido = await hashFirmaComunicacion(c, fechaHora);
      const resuelto = await resolverFirma(hashContenido);
      const firma = await db.firma.create({
        data: {
          calidad: solicitud.calidad,
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
      firmaId = firma.id;
    }
    await db.solicitudFirma.update({
      where: { id: solicitudId },
      data: { estado: "COMPLETADA", completadoEn: new Date(), firmaId, ip, userAgent },
    });
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: c.id,
      accion: "FIRMA",
      usuarioId,
      ip,
      userAgent,
      detalle: `Firmó "${c.radicado}" (solicitud asignada)`,
    }).catch((e) => console.error("registrarAuditoriaDoc (completarSolicitudFirma comunicacion) falló:", e));
  } else if (solicitud.documentoArchivo) {
    const doc = solicitud.documentoArchivo;
    await validarDocumentoArchivoFirmable(doc.id);
    let firmaId: string;
    const previa = await db.firma.findFirst({ where: { documentoArchivoId: doc.id, usuarioId }, select: { id: true } });
    if (previa) {
      firmaId = previa.id;
    } else {
      const firma = await crearFirmaDocumentoArchivo(doc, usuarioId, solicitud.calidad, ip, userAgent);
      firmaId = firma.id;
    }
    await db.solicitudFirma.update({
      where: { id: solicitudId },
      data: { estado: "COMPLETADA", completadoEn: new Date(), firmaId, ip, userAgent },
    });
    await registrarAuditoriaDoc({
      entidad: "DocumentoArchivo",
      entidadId: doc.id,
      accion: "FIRMA",
      usuarioId,
      ip,
      userAgent,
      detalle: `Firmó "${doc.nombre}" (solicitud asignada)`,
    }).catch((e) => console.error("registrarAuditoriaDoc (completarSolicitudFirma documentoArchivo) falló:", e));
  }
}

async function crearFirmaDocumentoArchivo(
  doc: { id: string; nombre: string; hashSha256: string | null },
  usuarioId: string,
  calidad: CalidadFirma | null,
  ip: string | null,
  userAgent: string | null,
) {
  const fechaHora = new Date();
  const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso: fechaHora.toISOString() });
  const resuelto = await resolverFirma(hashContenido);
  return db.firma.create({
    data: {
      usuarioId,
      documentoArchivoId: doc.id,
      calidad,
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
}

export async function firmarDocumentoArchivoDirecto(documentoArchivoId: string, usuarioId: string, ip: string | null, userAgent: string | null) {
  await validarDocumentoArchivoFirmable(documentoArchivoId);
  const doc = await db.documentoArchivo.findUnique({ where: { id: documentoArchivoId }, select: { id: true, nombre: true, hashSha256: true } });
  if (!doc) throw new Error("El documento no existe.");
  if (await db.firma.findFirst({ where: { documentoArchivoId, usuarioId }, select: { id: true } })) {
    throw new Error("Usted ya firmó este documento.");
  }
  const solicitudes = await db.solicitudFirma.findMany({
    where: { documentoArchivoId, rol: { not: "LECTURA" } },
    select: { id: true, usuarioAsignadoId: true, rol: true, orden: true, estado: true },
  });
  const propia = solicitudes.find((x) => x.usuarioAsignadoId === usuarioId && x.estado === "PENDIENTE" && x.rol === "FIRMA");
  if (propia) {
    await completarSolicitudFirma(propia.id, usuarioId, ip, userAgent);
    return;
  }
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { denominacionEmpleo: true, rolContratacion: true } });
  if (!usuario) throw new Error("El usuario no existe.");
  if (!puedeActuarSolicitud(solicitudes, { rol: "FIRMA", orden: nivelFirma(usuario) })) {
    throw new Error("Hay firmas pendientes de un cargo superior: deben firmar primero.");
  }
  await crearFirmaDocumentoArchivo(doc, usuarioId, puedeSerFirmantePrincipal(usuario, "SGDEA") ? "PRINCIPAL" : "PROYECTO", ip, userAgent);
}

export async function rechazarSolicitudFirma(
  solicitudId: string,
  usuarioId: string,
  comentario: string,
  ip: string | null = null,
  userAgent: string | null = null
) {
  if (!comentario.trim()) throw new Error("Indique el motivo del rechazo.");
  const solicitud = await db.solicitudFirma.findUnique({
    where: { id: solicitudId },
    include: {
      documentoContrato: { select: { id: true, nombre: true, expedienteId: true, subidoPorId: true } },
      documentoExpediente: { select: { id: true, nombre: true, expedienteId: true, pasoNumero: true, subidoPorId: true } },
      comunicacion: { select: { id: true, tipo: true, radicado: true, radicadoPorId: true, respuestaPorId: true } },
      documentoArchivo: { select: { id: true, nombre: true, subidoPorId: true } },
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
  } else if (solicitud.comunicacion) {
    const c = solicitud.comunicacion;
    const avisarA = (c.tipo === "RECIBIDA" ? c.respuestaPorId : null) ?? solicitud.asignadoPorId ?? c.radicadoPorId;
    if (avisarA) {
      await db.avisoRechazoDocumento.create({
        data: { comunicacionId: c.id, mensaje: comentario.trim(), rechazadoPorId: usuarioId, subidoPorId: avisarA },
      });
    }
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: c.id,
      accion: "RECHAZA_FIRMA",
      usuarioId,
      ip,
      userAgent,
      detalle: `Rechazó ${solicitud.rol === "VISTO_BUENO" ? "el visto bueno" : "la firma"} de "${c.radicado}": ${comentario.trim()}`,
    }).catch((e) => console.error("registrarAuditoriaDoc (rechazarSolicitudFirma comunicacion) falló:", e));
  } else if (solicitud.documentoArchivo) {
    const doc = solicitud.documentoArchivo;
    await db.avisoRechazoDocumento.create({
      data: { documentoArchivoId: doc.id, mensaje: comentario.trim(), rechazadoPorId: usuarioId, subidoPorId: doc.subidoPorId },
    });
    await registrarAuditoriaDoc({
      entidad: "DocumentoArchivo",
      entidadId: doc.id,
      accion: "RECHAZA_FIRMA",
      usuarioId,
      ip,
      userAgent,
      detalle: `Rechazó ${solicitud.rol === "VISTO_BUENO" ? "el visto bueno" : "la firma"} de "${doc.nombre}": ${comentario.trim()}`,
    }).catch((e) => console.error("registrarAuditoriaDoc (rechazarSolicitudFirma documentoArchivo) falló:", e));
  }
}

export async function contarRechazosPorAtender(
  usuarioId: string,
  veTodos: boolean,
  tipo: "documentoContrato" | "documentoExpediente",
): Promise<number> {
  return db.avisoRechazoDocumento.count({
    where: {
      ...(tipo === "documentoContrato" ? { documentoContratoId: { not: null } } : { documentoExpedienteId: { not: null } }),
      ...(veTodos ? {} : { subidoPorId: usuarioId }),
    },
  });
}

export type RechazoFirmaHistorial = {
  id: string;
  documentoNombre: string;
  expedienteId: string;
  expedienteNumero: string;
  motivo: string;
  rechazadoPor: string;
  subidoPor: string;
  fecha: Date;
};

export async function listarHistorialRechazosFirma(
  usuarioId: string,
  veTodos: boolean,
  tipo: "documentoContrato" | "documentoExpediente",
): Promise<RechazoFirmaHistorial[]> {
  const docSelect = {
    select: {
      nombre: true,
      expedienteId: true,
      expediente: { select: { numero: true } },
      subidoPor: { select: { nombre: true } },
    },
  };
  const filtroDocumento =
    tipo === "documentoContrato"
      ? {
          documentoContratoId: { not: null },
          ...(veTodos
            ? {}
            : {
                OR: [
                  { usuarioAsignadoId: usuarioId },
                  { documentoContrato: { subidoPorId: usuarioId } },
                  { documentoContrato: { expediente: { supervisores: { some: { usuarioId } } } } },
                ],
              }),
        }
      : { documentoExpedienteId: { not: null }, ...(veTodos ? {} : { OR: [{ usuarioAsignadoId: usuarioId }, { documentoExpediente: { subidoPorId: usuarioId } }] }) };
  const solicitudes = await db.solicitudFirma.findMany({
    where: { estado: "RECHAZADA", ...filtroDocumento },
    orderBy: { completadoEn: "desc" },
    take: 100,
    include: {
      usuarioAsignado: { select: { nombre: true } },
      documentoContrato: docSelect,
      documentoExpediente: docSelect,
    },
  });
  return solicitudes.flatMap((s) => {
    const doc = tipo === "documentoContrato" ? s.documentoContrato : s.documentoExpediente;
    if (!doc) return [];
    return [{
      id: s.id,
      documentoNombre: doc.nombre,
      expedienteId: doc.expedienteId,
      expedienteNumero: doc.expediente.numero,
      motivo: s.comentario ?? "",
      rechazadoPor: s.usuarioAsignado.nombre,
      subidoPor: doc.subidoPor.nombre,
      fecha: s.completadoEn ?? s.asignadoEn,
    }];
  });
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

export async function contarPendientesBuzonContratacion(usuarioId: string): Promise<ResumenPendientesFirma> {
  return resumirPendientesFirma(await listarBuzon(usuarioId, "documentoContrato"));
}

export async function contarPendientesBuzonTramite(usuarioId: string): Promise<ResumenPendientesFirma> {
  return resumirPendientesFirma(await listarBuzon(usuarioId, "documentoExpediente"));
}

export async function listarBuzon(usuarioId: string, tipo: TipoObjetivo) {
  const filtroTipo =
    tipo === "comunicacion"
      ? { comunicacionId: { not: null } }
      : tipo === "documentoContrato"
        ? { documentoContratoId: { not: null } }
        : tipo === "documentoArchivo"
          ? { documentoArchivoId: { not: null } }
          : { documentoExpedienteId: { not: null } };

  const solicitudes = await db.solicitudFirma.findMany({
    where: { usuarioAsignadoId: usuarioId, estado: "PENDIENTE", ...filtroTipo },
    include: {
      asignadoPor: { select: { nombre: true } },
      comunicacion: { select: { id: true, radicado: true, asunto: true, tipo: true, documentos: { select: { id: true, nombre: true, mimeType: true }, orderBy: { createdAt: "asc" } } } },
      documentoArchivo: {
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          expedienteDocumentalId: true,
          expediente: { select: { numero: true, asunto: true } },
        },
      },
      documentoContrato: {
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          expedienteId: true,
          expediente: { select: { numero: true } },
          firmas: { select: { id: true } },
          solicitudesFirma: { where: { rol: "VISTO_BUENO", estado: "COMPLETADA" }, select: { id: true } },
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
          solicitudesFirma: { where: { rol: "VISTO_BUENO", estado: "COMPLETADA" }, select: { id: true } },
        },
      },
    },
    orderBy: { asignadoEn: "asc" },
  });

  const idsObjetivo = solicitudes.map(claveObjetivo);
  const hermanasPorObjetivo = new Map<string, { rol: RolFirmante; orden: number; estado: EstadoSolicitudFirma }[]>();
  if (idsObjetivo.length > 0) {
    const hermanas = await db.solicitudFirma.findMany({
      where:
        tipo === "comunicacion"
          ? { comunicacionId: { in: idsObjetivo } }
          : tipo === "documentoContrato"
            ? { documentoContratoId: { in: idsObjetivo } }
            : tipo === "documentoArchivo"
              ? { documentoArchivoId: { in: idsObjetivo } }
              : { documentoExpedienteId: { in: idsObjetivo } },
      select: { comunicacionId: true, documentoContratoId: true, documentoExpedienteId: true, documentoArchivoId: true, rol: true, orden: true, estado: true },
    });
    for (const h of hermanas) {
      const clave = claveObjetivo(h);
      if (!hermanasPorObjetivo.has(clave)) hermanasPorObjetivo.set(clave, []);
      hermanasPorObjetivo.get(clave)!.push(h);
    }
  }

  return solicitudes.map((s) => {
    const clave = claveObjetivo(s);
    return {
      ...s,
      puedeActuar: puedeActuarSolicitud(hermanasPorObjetivo.get(clave) ?? [], s),
    };
  });
}
