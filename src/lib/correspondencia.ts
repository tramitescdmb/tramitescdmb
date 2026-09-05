import { db } from "@/lib/db";
import type { MedioComunicacion, OrigenComunicacion, TipoPQRSD, TipoSolicitante, Prisma } from "@prisma/client";
import { generarRadicado } from "@/lib/radicado";
import { hashContenidoFirma } from "@/lib/firma";
import { TERMINO_DIAS_HABILES, calcularVencimiento, calcularVencimientoTrasReactivar } from "@/lib/pqrsd";
import { REQUIERE_ACTA } from "@/lib/disposicion-final";

/**
 * Dominio de correspondencia (SGDEA). Fase 1: radicación de comunicaciones
 * RECIBIDAS en la ventanilla única. El radicado se genera atómicamente dentro
 * de la misma transacción que crea la comunicación (ver src/lib/radicado.ts):
 * si la creación falla, el número se revierte con la transacción, sin huecos.
 */

export type EntradaTercero = {
  tipo: TipoSolicitante;
  tipoIdentificacion?: string | null; // CC, CE, NIT, PA, TI, ANONIMO...
  identificacion?: string | null;
  nombre: string; // razón social o nombre completo tal como llega
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  municipio?: string | null;
};

export type EntradaDocumento = {
  path: string;
  nombre: string;
  descripcion?: string | null;
  mimeType: string;
  tamanoBytes: number;
  hashSha256?: string | null;
};

export type EntradaRadicacionRecibida = {
  asunto: string;
  contenido?: string | null; // narración de una PQRSD (Fase 3) — el resto de recibidas no lo usa
  folios: number;
  anexosDescripcion?: string | null;
  medio?: MedioComunicacion | null;
  origen?: OrigenComunicacion | null; // VENTANILLA por defecto; WEB_PQRSD cuando llega del formulario público
  tercero: EntradaTercero;
  dependenciaDestinoId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  tipoPqrsd?: TipoPQRSD | null; // clasifica la PQRSD y fija su término de ley (Fase 3)
  documentos?: EntradaDocumento[];
  radicadoPorId: string | null; // null = radicada anónimamente desde el formulario público
};

/** Vincula al maestro Solicitante SOLO si el tercero viene identificado y con municipio
 * (Solicitante.municipio es obligatorio) — si no, queda solo el snapshot en la comunicación,
 * sin ensuciar el maestro con datos incompletos de un tercero ocasional. Compartido entre
 * remitente (recibida) y destinatario (enviada). */
async function resolverOCrearTercero(tx: Prisma.TransactionClient, tercero: EntradaTercero): Promise<string | null> {
  const ident = tercero.identificacion?.trim() || null;
  const muni = tercero.municipio?.trim() || null;
  if (!ident || !muni) return null;
  const esJuridica = tercero.tipo === "JURIDICA";
  const solicitante = await tx.solicitante.upsert({
    where: { identificacion: ident },
    create: {
      tipo: tercero.tipo,
      identificacion: ident,
      razonSocial: esJuridica ? tercero.nombre : null,
      nombres: esJuridica ? null : tercero.nombre,
      email: tercero.email ?? null,
      telefono: tercero.telefono ?? null,
      direccion: tercero.direccion ?? null,
      municipio: muni,
    },
    update: {
      email: tercero.email ?? undefined,
      telefono: tercero.telefono ?? undefined,
      direccion: tercero.direccion ?? undefined,
    },
  });
  return solicitante.id;
}

export async function radicarRecibida(entrada: EntradaRadicacionRecibida) {
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("RECIBIDA", new Date().getFullYear(), tx);
    const ident = entrada.tercero.identificacion?.trim() || null;
    const muni = entrada.tercero.municipio?.trim() || null;
    const terceroId = await resolverOCrearTercero(tx, entrada.tercero);
    const fechaRadicacion = new Date();
    const terminoDiasHabiles = entrada.tipoPqrsd ? TERMINO_DIAS_HABILES[entrada.tipoPqrsd] : null;
    const fechaVencimiento = entrada.tipoPqrsd ? calcularVencimiento(fechaRadicacion, entrada.tipoPqrsd) : null;

    const comunicacion = await tx.comunicacion.create({
      data: {
        tipo: "RECIBIDA",
        radicado,
        anio,
        fechaRadicacion,
        medio: entrada.medio ?? null,
        origen: entrada.origen ?? "VENTANILLA",
        estado: "RADICADA",
        asunto: entrada.asunto,
        contenido: entrada.contenido ?? null,
        folios: entrada.folios,
        anexosDescripcion: entrada.anexosDescripcion ?? null,
        terceroId,
        terceroTipo: entrada.tercero.tipo,
        terceroTipoIdentificacion: entrada.tercero.tipoIdentificacion ?? null,
        terceroIdentificacion: ident,
        terceroNombre: entrada.tercero.nombre,
        terceroEmail: entrada.tercero.email ?? null,
        terceroTelefono: entrada.tercero.telefono ?? null,
        terceroDireccion: entrada.tercero.direccion ?? null,
        terceroMunicipio: muni,
        dependenciaDestinoId: entrada.dependenciaDestinoId ?? null,
        serieId: entrada.serieId ?? null,
        subserieId: entrada.subserieId ?? null,
        tipoPqrsd: entrada.tipoPqrsd ?? null,
        terminoDiasHabiles,
        fechaVencimiento,
        radicadoPorId: entrada.radicadoPorId,
      },
    });

    await crearDocumentos(tx, comunicacion.id, entrada.documentos, entrada.radicadoPorId);

    return comunicacion;
  });
}

async function crearDocumentos(tx: Prisma.TransactionClient, comunicacionId: string, documentos: EntradaDocumento[] | undefined, subidoPorId: string | null) {
  if (!documentos?.length) return;
  await tx.comunicacionDocumento.createMany({
    data: documentos.map((doc) => ({
      comunicacionId,
      nombre: doc.nombre,
      descripcion: doc.descripcion ?? null,
      storagePath: doc.path,
      mimeType: doc.mimeType,
      tamanoBytes: doc.tamanoBytes,
      hashSha256: doc.hashSha256 ?? null,
      subidoPorId,
    })),
  });
}

/** Crea la Firma electrónica (hash) del contenido exacto que se radica, en la misma transacción. */
async function firmarEnTransaccion(
  tx: Prisma.TransactionClient,
  datos: { comunicacionId: string; usuarioId: string; radicado: string; asunto: string; contenido: string | null }
) {
  const fechaHora = new Date();
  const hashContenido = hashContenidoFirma({ radicado: datos.radicado, asunto: datos.asunto, contenido: datos.contenido, fechaIso: fechaHora.toISOString() });
  await tx.firma.create({
    data: { usuarioId: datos.usuarioId, comunicacionId: datos.comunicacionId, fechaHora, hashContenido, tipo: "ELECTRONICA_HASH" },
  });
}

export type EntradaRadicacionEnviada = {
  asunto: string;
  contenido: string; // cuerpo del oficio — se firma junto con el asunto y el radicado
  folios: number;
  anexosDescripcion?: string | null;
  medio?: MedioComunicacion | null;
  destinatario: EntradaTercero;
  dependenciaOrigenId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  respondeAId?: string | null; // radica en respuesta a una RECIBIDA — la marca como RESPONDIDA
  documentos?: EntradaDocumento[];
  radicadoPorId: string;
};

export async function radicarEnviada(entrada: EntradaRadicacionEnviada) {
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("ENVIADA", new Date().getFullYear(), tx);
    const ident = entrada.destinatario.identificacion?.trim() || null;
    const muni = entrada.destinatario.municipio?.trim() || null;
    const terceroId = await resolverOCrearTercero(tx, entrada.destinatario);

    if (entrada.respondeAId) {
      const original = await tx.comunicacion.findUnique({ where: { id: entrada.respondeAId }, select: { id: true, tipo: true } });
      if (!original || original.tipo !== "RECIBIDA") throw new Error("La comunicación a la que responde no existe o no es una recibida.");
    }

    const comunicacion = await tx.comunicacion.create({
      data: {
        tipo: "ENVIADA",
        radicado,
        anio,
        medio: entrada.medio ?? null,
        origen: "VENTANILLA",
        estado: "RADICADA",
        asunto: entrada.asunto,
        contenido: entrada.contenido,
        folios: entrada.folios,
        anexosDescripcion: entrada.anexosDescripcion ?? null,
        terceroId,
        terceroTipo: entrada.destinatario.tipo,
        terceroTipoIdentificacion: entrada.destinatario.tipoIdentificacion ?? null,
        terceroIdentificacion: ident,
        terceroNombre: entrada.destinatario.nombre,
        terceroEmail: entrada.destinatario.email ?? null,
        terceroTelefono: entrada.destinatario.telefono ?? null,
        terceroDireccion: entrada.destinatario.direccion ?? null,
        terceroMunicipio: muni,
        dependenciaOrigenId: entrada.dependenciaOrigenId ?? null,
        serieId: entrada.serieId ?? null,
        subserieId: entrada.subserieId ?? null,
        respondeAId: entrada.respondeAId ?? null,
        radicadoPorId: entrada.radicadoPorId,
      },
    });

    await crearDocumentos(tx, comunicacion.id, entrada.documentos, entrada.radicadoPorId);
    await firmarEnTransaccion(tx, { comunicacionId: comunicacion.id, usuarioId: entrada.radicadoPorId, radicado, asunto: entrada.asunto, contenido: entrada.contenido });

    if (entrada.respondeAId) {
      await tx.comunicacion.update({ where: { id: entrada.respondeAId }, data: { estado: "RESPONDIDA" } });
    }

    return comunicacion;
  });
}

export type EntradaRadicacionInterna = {
  asunto: string;
  contenido: string; // cuerpo del memorando — se firma junto con el asunto y el radicado
  folios: number;
  dependenciaOrigenId: string;
  dependenciaDestinoId: string;
  serieId?: string | null;
  subserieId?: string | null;
  documentos?: EntradaDocumento[];
  radicadoPorId: string;
};

/** Memorando interno entre dependencias — se firma en la misma transacción (Ley 527/1999). */
export async function radicarInterna(entrada: EntradaRadicacionInterna) {
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("INTERNA", new Date().getFullYear(), tx);

    const comunicacion = await tx.comunicacion.create({
      data: {
        tipo: "INTERNA",
        radicado,
        anio,
        origen: "VENTANILLA",
        estado: "RADICADA",
        asunto: entrada.asunto,
        contenido: entrada.contenido,
        folios: entrada.folios,
        dependenciaOrigenId: entrada.dependenciaOrigenId,
        dependenciaDestinoId: entrada.dependenciaDestinoId,
        serieId: entrada.serieId ?? null,
        subserieId: entrada.subserieId ?? null,
        radicadoPorId: entrada.radicadoPorId,
      },
    });

    await crearDocumentos(tx, comunicacion.id, entrada.documentos, entrada.radicadoPorId);
    await firmarEnTransaccion(tx, { comunicacionId: comunicacion.id, usuarioId: entrada.radicadoPorId, radicado, asunto: entrada.asunto, contenido: entrada.contenido });

    return comunicacion;
  });
}

/** Archiva una comunicación ya radicada dentro de un expediente (unificación con Trámites 2.0). */
export async function archivarEnExpediente(comunicacionId: string, expedienteId: string) {
  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { id: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { expedienteId } });
}

/** Suspende el término de ley (Art. 17 CPACA) mientras se espera información adicional del peticionario. */
export async function suspenderTermino(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, estado: true, fechaVencimiento: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (!c.fechaVencimiento) throw new Error("Esta comunicación no tiene un término de ley que suspender.");
  if (c.estado === "INFORMACION_ADICIONAL_REQUERIDA") throw new Error("El término ya está suspendido.");
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: { estado: "INFORMACION_ADICIONAL_REQUERIDA", fechaSuspensionTermino: new Date() },
  });
}

/** Reactiva un término suspendido: se reanuda por los días hábiles que faltaban, no se reinicia (Art. 17 CPACA). */
export async function reactivarTermino(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, estado: true, fechaRadicacion: true, fechaSuspensionTermino: true, terminoDiasHabiles: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado !== "INFORMACION_ADICIONAL_REQUERIDA" || !c.fechaSuspensionTermino || !c.terminoDiasHabiles) {
    throw new Error("Esta comunicación no tiene un término suspendido.");
  }
  const fechaVencimiento = calcularVencimientoTrasReactivar(c.fechaRadicacion, c.fechaSuspensionTermino, new Date(), c.terminoDiasHabiles);
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: { estado: "EN_TRAMITE", fechaSuspensionTermino: null, fechaVencimiento },
  });
}

/** Transferencia del archivo de gestión al archivo central (Acuerdo 004/2019 AGN) — solo deja constancia de la fecha. */
export async function transferirACentral(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, transferidaCentralEn: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.transferidaCentralEn) throw new Error("Ya fue transferida al archivo central.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { transferidaCentralEn: new Date() } });
}

export type EntradaDisposicionFinal = {
  comunicacionId: string;
  responsable: string; // quien aprueba (comité de archivo) — exigido solo si la disposición requiere acta
  motivacion?: string | null;
  aprobadaPorId?: string | null;
};

/**
 * Ejecuta la disposición final de una comunicación según lo que diga la TRD de su
 * subserie. Eliminación/selección exigen un acta (se crea una por ejecución); la
 * comunicación en sí NUNCA se borra de la base — solo queda marcada con la fecha
 * y, si aplica, enlazada al acta que autorizó destruir el original.
 */
export async function ejecutarDisposicionFinal(entrada: EntradaDisposicionFinal) {
  const c = await db.comunicacion.findUnique({
    where: { id: entrada.comunicacionId },
    select: { id: true, fechaDisposicionFinal: true, subserie: { select: { disposicionFinal: true } } },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.fechaDisposicionFinal) throw new Error("Ya se ejecutó la disposición final de esta comunicación.");
  const disposicion = c.subserie?.disposicionFinal;
  if (!disposicion) throw new Error("La subserie de esta comunicación no tiene una disposición final definida en la TRD.");

  if (!REQUIERE_ACTA[disposicion]) {
    return db.comunicacion.update({ where: { id: c.id }, data: { fechaDisposicionFinal: new Date() } });
  }

  if (!entrada.responsable.trim()) throw new Error("Esta disposición (eliminación/selección) exige indicar quién la aprueba.");
  return db.$transaction(async (tx) => {
    const acta = await tx.actaEliminacion.create({
      data: {
        responsable: entrada.responsable.trim(),
        motivacion: entrada.motivacion?.trim() || null,
        aprobadaPorId: entrada.aprobadaPorId ?? null,
        comunicaciones: { connect: { id: c.id } },
      },
    });
    return tx.comunicacion.update({ where: { id: c.id }, data: { fechaDisposicionFinal: new Date(), actaEliminacionId: acta.id } });
  });
}
