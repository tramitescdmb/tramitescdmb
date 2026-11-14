import { db } from "@/lib/db";
import { huellaVerificada } from "@/lib/hash-archivo";
import { resolverFirma } from "@/lib/firma-proveedor";
import type { RolFirmante, EstadoSolicitudFirma, CalidadFirma } from "@prisma/client";
import crypto from "crypto";
import { estadoPorFirmas } from "@/lib/estado-firmas";
import { resumirPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";
import { cargoDelFirmante, esContratista, nivelFirma, puedeSerFirmantePrincipal, puedeSolicitarFirmas, type ModuloFirma } from "@/lib/jerarquia-firma";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { hashFirmaComunicacion, validarComunicacionFirmable, verificarHuellasAdjuntos, SELECT_COMUNICACION_FIRMABLE } from "@/lib/firma-comunicacion";
import { supervisoresDelExpediente } from "@/lib/firmantes-gecon";
import { claveMatriz, programarAvisos, type Mensaje } from "@/lib/avisos-correo";
import { componerMensaje, plantillaDeEvento } from "@/lib/plantillas-correo-base";

const SELECT_FIRMANTE_CARGO = {
  denominacionEmpleo: true,
  denominacionComplemento: true,
  denominacionEncargo: true,
  sexo: true,
  rolesContratacion: true,
  actoAdministrativoCargo: true,
} as const;

async function cargoActualDelFirmante(
  usuarioId: string,
  modulo: ModuloFirma,
  supervisaElExpediente = false,
): Promise<{ cargoAlFirmar: string; actoAdministrativoAlFirmar: string | null }> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_FIRMANTE_CARGO });
  if (!u) return { cargoAlFirmar: "Funcionario", actoAdministrativoAlFirmar: null };
  return { cargoAlFirmar: cargoDelFirmante({ ...u, supervisaElExpediente }, modulo), actoAdministrativoAlFirmar: u.actoAdministrativoCargo?.trim() || null };
}

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

export const BUZON_POR_MODULO: Record<ModuloFirma, string> = {
  TRAMITES: "/firmas/buzon",
  GECON: "/contratacion/buzon",
  SGDEA: "/correspondencia/buzon",
};

export function rutaDeFirma(solicitudId: string, modulo: ModuloFirma, rutaDocumento: string): string {
  if (modulo === "TRAMITES") return `/firmas/firmar/${solicitudId}`;
  if (modulo === "GECON") return `/contratacion/firmar/${solicitudId}`;
  return rutaDocumento;
}

export async function describirObjetivo(objetivo: ObjetivoSolicitud): Promise<{ nombre: string; referencia: string; ruta: string }> {
  if (objetivo.tipo === "comunicacion") {
    const c = await db.comunicacion.findUnique({ where: { id: objetivo.id }, select: { radicado: true, asunto: true } });
    return { nombre: c?.asunto.slice(0, 120) ?? "Comunicación", referencia: c?.radicado ?? "SGDEA", ruta: `/correspondencia/${objetivo.id}` };
  }
  if (objetivo.tipo === "documentoContrato") {
    const d = await db.documentoContrato.findUnique({ where: { id: objetivo.id }, select: { nombre: true, expedienteId: true, expediente: { select: { numero: true } } } });
    return { nombre: d?.nombre ?? "Documento", referencia: d?.expediente.numero ?? "GECON", ruta: d ? `/contratacion/expedientes/${d.expedienteId}#documento-${objetivo.id}` : BUZON_POR_MODULO.GECON };
  }
  if (objetivo.tipo === "documentoArchivo") {
    const d = await db.documentoArchivo.findUnique({ where: { id: objetivo.id }, select: { nombre: true, expedienteDocumentalId: true, expediente: { select: { numero: true } } } });
    return { nombre: d?.nombre ?? "Documento", referencia: d?.expediente.numero ?? "SGDEA", ruta: d ? `/correspondencia/expedientes/${d.expedienteDocumentalId}` : BUZON_POR_MODULO.SGDEA };
  }
  const d = await db.expedienteDocumento.findUnique({ where: { id: objetivo.id }, select: { nombre: true, expedienteId: true, expediente: { select: { numero: true } } } });
  return { nombre: d?.nombre ?? "Documento", referencia: d?.expediente.numero ?? "Trámite", ruta: d ? `/expedientes/${d.expedienteId}` : BUZON_POR_MODULO.TRAMITES };
}

type DocumentoAviso = { nombre: string; referencia: string; ruta: string };

export function mensajeFirmaSolicitada(d: { modulo: ModuloFirma; firma: boolean; asignador: string; doc: DocumentoAviso; ruta: string }): Mensaje {
  return componerMensaje(
    plantillaDeEvento("FIRMA_SOLICITADA", d.modulo),
    {
      ASIGNADOR: d.asignador,
      DOCUMENTO: d.doc.nombre,
      REFERENCIA: d.doc.referencia,
      TIPO_SOLICITUD: d.firma ? "Firma solicitada" : "Visto bueno solicitado",
      PENDIENTE: d.firma ? "por firmar" : "para visto bueno",
      ACCION: d.firma ? "firmar" : "dar visto bueno a",
      ACCION_CORTA: d.firma ? "firmar" : "dar visto bueno",
      ES_FIRMA: d.firma ? "sí" : "",
    },
    d.ruta
  );
}

export function mensajeFirmaRecordada(d: { modulo: ModuloFirma; quien: string; doc: DocumentoAviso; ruta: string }): Mensaje {
  return componerMensaje(plantillaDeEvento("FIRMA_RECORDADA", d.modulo), { QUIEN: d.quien, DOCUMENTO: d.doc.nombre, REFERENCIA: d.doc.referencia }, d.ruta);
}

export function mensajeFirmaRechazada(d: { modulo: ModuloFirma; visto: boolean; quien: string; doc: DocumentoAviso; motivo: string }): Mensaje {
  return componerMensaje(
    plantillaDeEvento("FIRMA_RECHAZADA", d.modulo),
    {
      QUIEN: d.quien,
      DOCUMENTO: d.doc.nombre,
      REFERENCIA: d.doc.referencia,
      MOTIVO: d.motivo.trim(),
      TIPO_RECHAZO: d.visto ? "Visto bueno rechazado" : "Firma rechazada",
      OBJETO: d.visto ? "el visto bueno" : "la firma",
    },
    d.doc.ruta
  );
}

const MAX_FIRMANTES_POR_OBJETIVO = 4;
const MENSAJE_FIRMA_EXPEDIENTE_CERRADO = "El expediente está cerrado: sus documentos ya no se pueden firmar.";

async function validarObjetivoAbierto(objetivo: ObjetivoSolicitud) {
  if (objetivo.tipo === "documentoExpediente") {
    const d = await db.expedienteDocumento.findUnique({ where: { id: objetivo.id }, select: { expediente: { select: { archivado: true } } } });
    if (d?.expediente.archivado) throw new Error(MENSAJE_FIRMA_EXPEDIENTE_CERRADO);
  } else if (objetivo.tipo === "documentoContrato") {
    const d = await db.documentoContrato.findUnique({ where: { id: objetivo.id }, select: { expediente: { select: { cerrado: true, eliminado: true } } } });
    if (d?.expediente.eliminado) throw new Error("El expediente fue eliminado: sus documentos ya no se pueden firmar.");
    if (d?.expediente.cerrado) throw new Error(MENSAJE_FIRMA_EXPEDIENTE_CERRADO);
  } else if (objetivo.tipo === "documentoArchivo") {
    const d = await db.documentoArchivo.findUnique({ where: { id: objetivo.id }, select: { expediente: { select: { estado: true } } } });
    if (d && d.expediente.estado !== "ABIERTO") throw new Error(MENSAJE_FIRMA_EXPEDIENTE_CERRADO);
  }
}

export function objetivoDeSolicitud(s: {
  comunicacionId: string | null;
  documentoContratoId: string | null;
  documentoExpedienteId: string | null;
  documentoArchivoId: string | null;
}): ObjetivoSolicitud {
  if (s.comunicacionId) return { tipo: "comunicacion", id: s.comunicacionId };
  if (s.documentoContratoId) return { tipo: "documentoContrato", id: s.documentoContratoId };
  if (s.documentoArchivoId) return { tipo: "documentoArchivo", id: s.documentoArchivoId };
  return { tipo: "documentoExpediente", id: s.documentoExpedienteId! };
}

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
  await validarObjetivoAbierto(objetivo);

  const modulo = moduloDeObjetivo(objetivo.tipo);
  const selectPersona = { id: true, nombre: true, activo: true, denominacionEmpleo: true, rolesContratacion: true } as const;
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
  // Dos asignaciones simultáneas sobre el mismo documento (doble clic, dos personas) se serializan y se
  // vuelve a comprobar dentro de la transacción, para que nadie quede asignado dos veces.
  await db.$transaction(async (tx) => {
    await bloquearFirma(tx, `asignar:${objetivo.tipo}:${objetivo.id}`);
    if (conAccion.length > 0) {
      const repetidas = await tx.solicitudFirma.count({
        where: { ...whereObjetivo(objetivo), usuarioAsignadoId: { in: conAccion.map((f) => f.usuarioId) }, rol: { not: "LECTURA" }, estado: { not: "RECHAZADA" } },
      });
      if (repetidas > 0) throw new Error("Otra persona acaba de asignar a alguno de estos firmantes en este documento. Recargue la página.");
    }
    await tx.solicitudFirma.createMany({ data });
  });

  if (firmantes.some((f) => f.rol === "FIRMA")) {
    if (objetivo.tipo === "documentoContrato") {
      await db.documentoContrato.updateMany({ where: { id: objetivo.id, requiereFirma: false }, data: { requiereFirma: true } });
      await reevaluarEstadoDocumentoContrato(objetivo.id, asignadoPorId);
    }
    else if (objetivo.tipo === "documentoExpediente") await reevaluarEstadoDocumentoExpediente(objetivo.id, asignadoPorId);
  }

  const porAvisar = firmantes.filter((f) => f.rol !== "LECTURA" && f.usuarioId !== asignadoPorId);
  if (porAvisar.length > 0) {
    const marca = Date.now();
    programarAvisos([claveMatriz(modulo, "FIRMA_SOLICITADA")], async () => {
      const [doc, creadas] = await Promise.all([
        describirObjetivo(objetivo),
        db.solicitudFirma.findMany({
          where: { ...whereObjetivo(objetivo), usuarioAsignadoId: { in: porAvisar.map((f) => f.usuarioId) }, estado: "PENDIENTE", rol: { not: "LECTURA" } },
          select: { id: true, usuarioAsignadoId: true },
        }),
      ]);
      return porAvisar.map((f) => {
        const solicitud = creadas.find((s) => s.usuarioAsignadoId === f.usuarioId);
        return {
          evento: "FIRMA_SOLICITADA" as const,
          modulo,
          clave: `firma-solicitada:${objetivo.id}:${f.usuarioId}:${f.rol}:${marca}`,
          usuarioIds: [f.usuarioId],
          ...mensajeFirmaSolicitada({ modulo, firma: f.rol === "FIRMA", asignador: asignador.nombre, doc, ruta: solicitud ? rutaDeFirma(solicitud.id, modulo, doc.ruta) : BUZON_POR_MODULO[modulo] }),
        };
      });
    });
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

/**
 * Firma o da visto bueno a una solicitud. Primero la "reserva" (marca completadoEn solo si sigue
 * pendiente y sin marca) para que un doble clic o dos pestañas no generen dos firmas del mismo
 * firmante sobre el mismo documento; si algo falla, la reserva se libera.
 */
export async function completarSolicitudFirma(
  solicitudId: string,
  usuarioId: string,
  ip: string | null,
  userAgent: string | null
) {
  const reservada = await db.solicitudFirma.updateMany({
    where: {
      id: solicitudId,
      usuarioAsignadoId: usuarioId,
      estado: "PENDIENTE",
      // Una reserva de más de 2 minutos se da por perdida (p. ej. el servicio se reinició a mitad de la firma).
      OR: [{ completadoEn: null }, { completadoEn: { lt: new Date(Date.now() - 2 * 60_000) } }],
    },
    data: { completadoEn: new Date() },
  });
  if (reservada.count === 0) {
    const actual = await db.solicitudFirma.findUnique({ where: { id: solicitudId }, select: { estado: true, usuarioAsignadoId: true } });
    if (!actual) throw new Error("La solicitud no existe.");
    if (actual.usuarioAsignadoId !== usuarioId) throw new Error("Esta solicitud no está asignada a usted.");
    if (actual.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");
    throw new Error("Esta firma ya se está procesando; espere unos segundos y recargue la página.");
  }
  try {
    await completarSolicitudFirmaReservada(solicitudId, usuarioId, ip, userAgent);
  } catch (e) {
    await db.solicitudFirma
      .updateMany({ where: { id: solicitudId, estado: "PENDIENTE" }, data: { completadoEn: null } })
      .catch((err) => console.error("No se pudo liberar la reserva de la solicitud de firma:", err));
    throw e;
  }
}

async function completarSolicitudFirmaReservada(
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
  await validarObjetivoAbierto(objetivoDeSolicitud(solicitud));
  // Regla de GECON, aplicada aquí para que valga por cualquier ruta (no solo la de contratación).
  if (solicitud.documentoContrato?.etapa === "PRECONTRACTUAL") {
    const firmante = await db.usuario.findUnique({ where: { id: usuarioId }, select: { denominacionEmpleo: true, rolesContratacion: true } });
    if (firmante && esContratista(firmante)) {
      throw new Error("El contratista no firma ni da visto bueno a documentos de la etapa Precontractual: solo puede consultarlos.");
    }
  }

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
    const supervisaVistoBueno = solicitud.documentoContrato
      ? (await supervisoresDelExpediente(solicitud.documentoContrato.expedienteId)).has(usuarioId)
      : false;
    const cargo = await cargoActualDelFirmante(usuarioId, moduloDeObjetivo(objetivoDeSolicitud(solicitud).tipo), supervisaVistoBueno);
    await db.solicitudFirma.update({ where: { id: solicitudId }, data: { estado: "COMPLETADA", completadoEn: new Date(), ...cargo, ip, userAgent } });
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

    const huella = await huellaVerificada(doc, await db.firmaDocumentoContrato.count({ where: { documentoId: doc.id } }), (h) =>
      db.documentoContrato.updateMany({ where: { id: doc.id, storagePath: doc.storagePath }, data: { hashSha256: h } })
    );
    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: huella, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const supervisaDocContrato = (await supervisoresDelExpediente(doc.expedienteId)).has(usuarioId);
    const cargo = await cargoActualDelFirmante(usuarioId, "GECON", supervisaDocContrato);
    await db.$transaction(async (tx) => {
      await exigirMismoArchivo(() => tx.documentoContrato.updateMany({ where: { id: doc.id, storagePath: doc.storagePath }, data: { hashSha256: huella } }));
      const f = await tx.firmaDocumentoContrato.create({
        data: {
          documentoId: doc.id,
          usuarioId,
          hashContenido,
          calidad: solicitud.calidad,
          ...cargo,
          ip,
          userAgent,
          proveedor: resuelto.proveedor,
          formato: resuelto.formato,
          selloTiempoEn: resuelto.selloTiempoEn,
          selloTiempoFuente: resuelto.selloTiempoFuente,
          selloTiempoToken: resuelto.selloTiempoToken,
        },
      });
      await cerrarSolicitudReservada(tx, solicitudId, { firmaDocContratoId: f.id, ip, userAgent });
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

    const huella = await huellaVerificada(doc, await db.firmaExpedienteDocumento.count({ where: { documentoId: doc.id } }), (h) =>
      db.expedienteDocumento.updateMany({ where: { id: doc.id, storagePath: doc.storagePath }, data: { hashSha256: h } })
    );
    const fechaIso = new Date().toISOString();
    const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: huella, fechaIso });
    const resuelto = await resolverFirma(hashContenido);
    const cargo = await cargoActualDelFirmante(usuarioId, "TRAMITES");
    await db.$transaction(async (tx) => {
      await exigirMismoArchivo(() => tx.expedienteDocumento.updateMany({ where: { id: doc.id, storagePath: doc.storagePath }, data: { hashSha256: huella } }));
      const f = await tx.firmaExpedienteDocumento.create({
        data: {
          documentoId: doc.id,
          usuarioId,
          hashContenido,
          calidad: solicitud.calidad,
          ...cargo,
          ip,
          userAgent,
          proveedor: resuelto.proveedor,
          formato: resuelto.formato,
          selloTiempoEn: resuelto.selloTiempoEn,
          selloTiempoFuente: resuelto.selloTiempoFuente,
          selloTiempoToken: resuelto.selloTiempoToken,
        },
      });
      await cerrarSolicitudReservada(tx, solicitudId, { firmaExpedienteId: f.id, ip, userAgent });
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
      await verificarHuellasAdjuntos(c);
      const fechaHora = new Date();
      const hashContenido = await hashFirmaComunicacion(c, fechaHora);
      const resuelto = await resolverFirma(hashContenido);
      const cargo = await cargoActualDelFirmante(usuarioId, "SGDEA");
      const firma = await db.firma.create({
        data: {
          calidad: solicitud.calidad,
          usuarioId,
          comunicacionId: c.id,
          fechaHora,
          hashContenido,
          tipo: "ELECTRONICA_HASH",
          ...cargo,
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
      const cargo = await cargoActualDelFirmante(usuarioId, "SGDEA");
      const firma = await crearFirmaDocumentoArchivo(doc, usuarioId, solicitud.calidad, cargo, ip, userAgent);
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

/**
 * Dentro de la transacción de la firma: bloquea la fila del documento y comprueba que siga siendo el
 * mismo archivo cuya huella se calculó. Si lo reemplazaron mientras se firmaba, no se firma.
 */
async function exigirMismoArchivo(actualizar: () => Promise<{ count: number }>) {
  const { count } = await actualizar();
  if (count === 0) throw new Error("El documento se reemplazó o eliminó mientras firmaba: recargue la página y revise la versión nueva.");
}

/** Marca la solicitud como completada solo si sigue pendiente (no la anularon ni la borraron al reemplazar el archivo). */
async function cerrarSolicitudReservada(
  tx: Pick<typeof db, "solicitudFirma">,
  solicitudId: string,
  data: { firmaDocContratoId?: string; firmaExpedienteId?: string; ip: string | null; userAgent: string | null }
) {
  const { count } = await tx.solicitudFirma.updateMany({
    where: { id: solicitudId, estado: "PENDIENTE" },
    data: { estado: "COMPLETADA", completadoEn: new Date(), ...data },
  });
  if (count === 0) throw new Error("La solicitud de firma ya no está vigente (se resolvió, anuló o se reemplazó el documento): recargue la página.");
}

async function crearFirmaDocumentoArchivo(
  doc: { id: string; nombre: string; hashSha256: string | null; storagePath: string },
  usuarioId: string,
  calidad: CalidadFirma | null,
  cargo: { cargoAlFirmar: string; actoAdministrativoAlFirmar: string | null },
  ip: string | null,
  userAgent: string | null,
  cliente: Pick<typeof db, "firma"> = db,
) {
  const huella = await huellaVerificada(doc, await db.firma.count({ where: { documentoArchivoId: doc.id } }), (h) =>
    db.documentoArchivo.updateMany({ where: { id: doc.id, storagePath: doc.storagePath }, data: { hashSha256: h } })
  );
  const fechaHora = new Date();
  const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: huella, fechaIso: fechaHora.toISOString() });
  const resuelto = await resolverFirma(hashContenido);
  return cliente.firma.create({
    data: {
      usuarioId,
      documentoArchivoId: doc.id,
      calidad,
      ...cargo,
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

/** Bloqueo de PostgreSQL que dura lo que la transacción: serializa dos firmas simultáneas de la misma persona. */
export async function bloquearFirma(tx: Pick<typeof db, "$queryRaw">, clave: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${clave}))::text AS ok`;
}

export async function firmarDocumentoArchivoDirecto(documentoArchivoId: string, usuarioId: string, ip: string | null, userAgent: string | null) {
  await validarDocumentoArchivoFirmable(documentoArchivoId);
  const doc = await db.documentoArchivo.findUnique({ where: { id: documentoArchivoId }, select: { id: true, nombre: true, hashSha256: true, storagePath: true } });
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
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_FIRMANTE_CARGO });
  if (!usuario) throw new Error("El usuario no existe.");
  if (!puedeActuarSolicitud(solicitudes, { rol: "FIRMA", orden: nivelFirma(usuario) })) {
    throw new Error("Hay firmas pendientes de un cargo superior: deben firmar primero.");
  }
  // Bloqueo por documento y firmante: un doble clic no crea dos firmas.
  await db.$transaction(async (tx) => {
    await bloquearFirma(tx, `archivo:${documentoArchivoId}:${usuarioId}`);
    if (await tx.firma.findFirst({ where: { documentoArchivoId, usuarioId }, select: { id: true } })) throw new Error("Usted ya firmó este documento.");
    await crearFirmaDocumentoArchivo(
      doc,
      usuarioId,
      puedeSerFirmantePrincipal(usuario, "SGDEA") ? "PRINCIPAL" : "PROYECTO",
      { cargoAlFirmar: cargoDelFirmante(usuario, "SGDEA"), actoAdministrativoAlFirmar: usuario.actoAdministrativoCargo?.trim() || null },
      ip,
      userAgent,
      tx,
    );
  });
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
  await validarObjetivoAbierto(objetivoDeSolicitud(solicitud));

  // Condicional: si la misma persona ya está firmando (reserva en curso) o la resolvió en otra pestaña, no se rechaza.
  const rechazada = await db.solicitudFirma.updateMany({
    where: {
      id: solicitudId,
      estado: "PENDIENTE",
      OR: [{ completadoEn: null }, { completadoEn: { lt: new Date(Date.now() - 2 * 60_000) } }],
    },
    data: { estado: "RECHAZADA", comentario: comentario.trim(), completadoEn: new Date() },
  });
  if (rechazada.count === 0) throw new Error("Esta solicitud ya fue resuelta o se está firmando en este momento. Recargue la página.");

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

  const c = solicitud.comunicacion;
  const avisar =
    solicitud.documentoContrato?.subidoPorId ??
    solicitud.documentoExpediente?.subidoPorId ??
    solicitud.documentoArchivo?.subidoPorId ??
    (c ? ((c.tipo === "RECIBIDA" ? c.respuestaPorId : null) ?? solicitud.asignadoPorId ?? c.radicadoPorId) : null);
  if (avisar && avisar !== usuarioId) {
    const objetivo = objetivoDeSolicitud(solicitud);
    const visto = solicitud.rol === "VISTO_BUENO";
    const modulo = moduloDeObjetivo(objetivo.tipo);
    programarAvisos([claveMatriz(modulo, "FIRMA_RECHAZADA")], async () => {
      const [doc, quien] = await Promise.all([describirObjetivo(objetivo), db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } })]);
      return {
        evento: "FIRMA_RECHAZADA",
        modulo,
        clave: `firma-rechazada:${solicitudId}`,
        usuarioIds: [avisar],
        ...mensajeFirmaRechazada({ modulo, visto, quien: quien?.nombre ?? "El firmante", doc, motivo: comentario }),
      };
    });
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
      recordadoPor: { select: { nombre: true } },
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
          expediente: { select: { numero: true, numeroContrato: true, codigoProceso: true, contratista: { select: { nombreORazonSocial: true } } } },
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
  type Hermana = { rol: RolFirmante; orden: number; estado: EstadoSolicitudFirma; recordadoEn: Date | null; usuarioAsignado: { nombre: string; correoNotificacion: string | null } };
  const hermanasPorObjetivo = new Map<string, Hermana[]>();
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
      select: {
        comunicacionId: true,
        documentoContratoId: true,
        documentoExpedienteId: true,
        documentoArchivoId: true,
        rol: true,
        orden: true,
        estado: true,
        recordadoEn: true,
        usuarioAsignado: { select: { nombre: true, correoNotificacion: true } },
      },
    });
    for (const h of hermanas) {
      const clave = claveObjetivo(h);
      if (!hermanasPorObjetivo.has(clave)) hermanasPorObjetivo.set(clave, []);
      hermanasPorObjetivo.get(clave)!.push(h);
    }
  }

  return solicitudes.map((s) => {
    const hermanas = hermanasPorObjetivo.get(claveObjetivo(s)) ?? [];
    return {
      ...s,
      puedeActuar: puedeActuarSolicitud(hermanas, s),
      esperaA: firmantesAnteriores(hermanas, s),
    };
  });
}

export type FirmanteAnterior = { nombre: string; recordadoEn: Date | null };

export function firmantesAnteriores<T extends { rol: RolFirmante; orden: number; estado: EstadoSolicitudFirma; recordadoEn?: Date | null; usuarioAsignado: { nombre: string } }>(
  todas: T[],
  solicitud: { orden: number }
): FirmanteAnterior[] {
  return todas
    .filter((s) => s.rol === "FIRMA" && s.orden < solicitud.orden && s.estado === "PENDIENTE")
    .map((s) => ({ nombre: s.usuarioAsignado.nombre, recordadoEn: s.recordadoEn ?? null }));
}

const ESPERA_ENTRE_RECORDATORIOS_MS = 4 * 60 * 60 * 1000;

export async function recordarFirmantesAnteriores(solicitudId: string, usuarioId: string): Promise<{ avisados: string[]; yaAvisados: string[] }> {
  const solicitud = await db.solicitudFirma.findUnique({
    where: { id: solicitudId },
    select: { usuarioAsignadoId: true, estado: true, orden: true, comunicacionId: true, documentoContratoId: true, documentoExpedienteId: true, documentoArchivoId: true },
  });
  if (!solicitud || solicitud.usuarioAsignadoId !== usuarioId) throw new Error("La solicitud no está asignada a usted.");
  if (solicitud.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");
  const anteriores = await db.solicitudFirma.findMany({
    where: { ...whereObjetivo(objetivoDeSolicitud(solicitud)), rol: "FIRMA", estado: "PENDIENTE", orden: { lt: solicitud.orden } },
    select: { id: true, recordadoEn: true, usuarioAsignadoId: true, usuarioAsignado: { select: { nombre: true } } },
  });
  if (anteriores.length === 0) throw new Error("Ya es su turno: no hay firmas anteriores pendientes.");
  const limite = Date.now() - ESPERA_ENTRE_RECORDATORIOS_MS;
  const porAvisar = anteriores.filter((a) => !a.recordadoEn || a.recordadoEn.getTime() < limite);
  if (porAvisar.length > 0) {
    await db.solicitudFirma.updateMany({ where: { id: { in: porAvisar.map((a) => a.id) } }, data: { recordadoEn: new Date(), recordadoPorId: usuarioId } });
    const objetivo = objetivoDeSolicitud(solicitud);
    const marca = Date.now();
    const modulo = moduloDeObjetivo(objetivo.tipo);
    programarAvisos([claveMatriz(modulo, "FIRMA_RECORDADA")], async () => {
      const [doc, quien] = await Promise.all([describirObjetivo(objetivo), db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } })]);
      return porAvisar.map((a) => ({
        evento: "FIRMA_RECORDADA" as const,
        modulo,
        clave: `firma-recordada:${a.id}:${marca}`,
        usuarioIds: [a.usuarioAsignadoId],
        ...mensajeFirmaRecordada({ modulo, quien: quien?.nombre ?? "Un firmante", doc, ruta: rutaDeFirma(a.id, modulo, doc.ruta) }),
      }));
    });
  }
  return {
    avisados: porAvisar.map((a) => a.usuarioAsignado.nombre),
    yaAvisados: anteriores.filter((a) => !porAvisar.includes(a)).map((a) => a.usuarioAsignado.nombre),
  };
}
