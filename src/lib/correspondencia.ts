import { db } from "@/lib/db";
import type { MedioComunicacion, OrigenComunicacion, TipoPQRSD, TipoSolicitante, Prisma, NivelAccesoInformacion } from "@prisma/client";
import { generarRadicado } from "@/lib/radicado";
import { hashContenidoFirma } from "@/lib/firma";
import { TERMINO_DIAS_HABILES, calcularVencimiento, calcularVencimientoTrasReactivar } from "@/lib/pqrsd";
import { algunaRequiereActa } from "@/lib/disposicion-final";

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

async function crearDocumentos(
  tx: Prisma.TransactionClient,
  comunicacionId: string,
  documentos: EntradaDocumento[] | undefined,
  subidoPorId: string | null,
  esRespuesta = false
) {
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
      esRespuesta,
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

    let documentosRespuestaFuncionario: EntradaDocumento[] = [];
    if (entrada.respondeAId) {
      const original = await tx.comunicacion.findUnique({ where: { id: entrada.respondeAId }, select: { id: true, tipo: true } });
      if (!original || original.tipo !== "RECIBIDA") throw new Error("La comunicación a la que responde no existe o no es una recibida.");
      // Los PDF/Word que el funcionario adjuntó a su respuesta se trasladan al oficio de
      // salida (misma ruta de Storage, sin volver a subir el archivo) — así ventanilla no
      // tiene que descargarlos y volverlos a cargar a mano.
      const adjuntosRespuesta = await tx.comunicacionDocumento.findMany({
        where: { comunicacionId: entrada.respondeAId, esRespuesta: true },
        select: { nombre: true, descripcion: true, storagePath: true, mimeType: true, tamanoBytes: true, hashSha256: true },
      });
      documentosRespuestaFuncionario = adjuntosRespuesta.map((doc) => ({
        path: doc.storagePath,
        nombre: doc.nombre,
        descripcion: doc.descripcion,
        mimeType: doc.mimeType,
        tamanoBytes: doc.tamanoBytes,
        hashSha256: doc.hashSha256,
      }));
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

    await crearDocumentos(tx, comunicacion.id, [...(entrada.documentos ?? []), ...documentosRespuestaFuncionario], entrada.radicadoPorId);
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

/** Anula un radicado erróneo dejando motivo (Ley 594/2000: nunca se borra, se anula con constancia). */
export async function anularComunicacion(comunicacionId: string, motivo: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, estado: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado === "ANULADA") throw new Error("Esta comunicación ya está anulada.");
  if (!motivo.trim()) throw new Error("Debe indicar el motivo de la anulación.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { estado: "ANULADA", motivoAnulacion: motivo.trim() } });
}

/**
 * Reclasifica una comunicación ya radicada a otra serie/subserie de la TRD, dejando motivo (MoReq req.
 * 1.30-1.32: reubicar en la clasificación con auditoría y motivo). No reclasifica retroactivamente lo que
 * ya se calculó con la clasificación anterior (ej. términos de ley ya corridos) — solo cambia hacia
 * adelante cuál regla de retención/disposición aplica.
 */
export async function reclasificarComunicacion(comunicacionId: string, subserieId: string, motivo: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: {
      id: true,
      estado: true,
      serie: { select: { codigo: true } },
      subserie: { select: { codigo: true, nombre: true } },
    },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado === "ANULADA") throw new Error("No se puede reclasificar una comunicación anulada.");
  if (!motivo.trim()) throw new Error("Debe indicar el motivo de la reclasificación.");

  const subserie = await db.subserieDocumental.findUnique({
    where: { id: subserieId },
    select: { id: true, codigo: true, nombre: true, serieId: true, serie: { select: { codigo: true, nombre: true } } },
  });
  if (!subserie) throw new Error("La subserie seleccionada no existe.");

  const anterior = c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : "sin clasificar";
  const nueva = `${subserie.codigo} — ${subserie.nombre} (${subserie.serie.nombre})`;

  await db.comunicacion.update({ where: { id: comunicacionId }, data: { serieId: subserie.serieId, subserieId: subserie.id } });
  return { anterior, nueva };
}

/**
 * Guarda (o revisa) el borrador de respuesta de una RECIBIDA. NO radica nada
 * — es la constancia de qué respondió el funcionario asignado, para que
 * ventanilla/gestión documental la retome y la radique como ENVIADA
 * (`respondeAId`) con consecutivo y firma.
 */
export async function registrarRespuestaFuncionario(
  comunicacionId: string,
  usuarioId: string,
  texto: string,
  documentos?: EntradaDocumento[]
) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, tipo: true, estado: true, _count: { select: { respuestas: true } } },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.tipo !== "RECIBIDA") throw new Error("Solo se responde a comunicaciones recibidas.");
  if (c.estado === "ANULADA") throw new Error("No se puede responder una comunicación anulada.");
  // Ya se radicó formalmente como oficio de salida (respondeAId) — el borrador cumplió su propósito;
  // editarlo ahora no cambiaría nada de lo que ya quedó firmado y despachado.
  if (c._count.respuestas > 0) throw new Error("Ya se radicó una respuesta formal para esta comunicación.");
  if (!texto.trim()) throw new Error("Escriba el contenido de la respuesta.");

  // El primer borrador es la señal real de que alguien ya está trabajando en esto — sin esto,
  // "En trámite" solo se alcanzaba suspendiendo y reactivando un término (un desvío raro), así que en
  // el flujo normal (asignar → responder → radicar salida) nunca se veía ese paso de la barra de avance.
  const pasaAEnTramite = c.estado === "ASIGNADA" || c.estado === "EN_REPARTO";

  return db.$transaction(async (tx) => {
    const actualizada = await tx.comunicacion.update({
      where: { id: comunicacionId },
      data: {
        respuestaTexto: texto.trim(),
        respuestaPorId: usuarioId,
        respuestaEn: new Date(),
        ...(pasaAEnTramite ? { estado: "EN_TRAMITE" } : {}),
      },
    });
    await crearDocumentos(tx, comunicacionId, documentos, usuarioId, true);
    return actualizada;
  });
}

/**
 * Cambia el nivel de acceso a la información de una comunicación (Ley 1712/2014,
 * arts. 6/18/19). PUBLICA no exige fundamento; CLASIFICADA/RESERVADA sí, por
 * escrito — la ley exige poder justificar por qué se restringe el acceso.
 */
export async function cambiarNivelAccesoComunicacion(comunicacionId: string, nivelAcceso: NivelAccesoInformacion, fundamento: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, estado: true, nivelAcceso: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado === "ANULADA") throw new Error("No se puede cambiar el nivel de acceso de una comunicación anulada.");
  if (nivelAcceso !== "PUBLICA" && !fundamento.trim()) {
    throw new Error("Clasificar o reservar información exige indicar el fundamento legal (Ley 1712/2014, arts. 18-19).");
  }

  await db.comunicacion.update({
    where: { id: comunicacionId },
    data: { nivelAcceso, fundamentoNivelAcceso: nivelAcceso === "PUBLICA" ? null : fundamento.trim() },
  });
  return { anterior: c.nivelAcceso, nuevo: nivelAcceso };
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

/**
 * Aplaza una disposición final ya vencida, con motivo obligatorio (MoReq 2.11)
 * — ej. mientras dura un proceso judicial o disciplinario sobre lo que
 * contiene la comunicación. Deja de aparecer como pendiente hasta la fecha
 * indicada; no reinicia el conteo de retención, solo pausa la ejecución.
 */
export async function aplazarDisposicion(comunicacionId: string, hasta: Date, motivo: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, estado: true, fechaDisposicionFinal: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado === "ANULADA") throw new Error("No se puede aplazar la disposición de una comunicación anulada.");
  if (c.fechaDisposicionFinal) throw new Error("Esta comunicación ya tiene ejecutada su disposición final.");
  if (!motivo.trim()) throw new Error("Debe indicar el motivo del aplazamiento.");
  if (hasta.getTime() <= Date.now()) throw new Error("La fecha de aplazamiento debe ser futura.");
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: { disposicionAplazadaHasta: hasta, motivoAplazamiento: motivo.trim() },
  });
}

/** Transferencia del archivo de gestión al archivo central (Acuerdo 004/2019 AGN) — solo deja constancia de la fecha. */
export async function transferirACentral(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, transferidaCentralEn: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.transferidaCentralEn) throw new Error("Ya fue transferida al archivo central.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { transferidaCentralEn: new Date() } });
}

export type EntradaDisposicionFinalLote = {
  comunicacionIds: string[];
  responsable: string;
  motivacion?: string | null;
  aprobadaPorId?: string | null;
};

export type ResultadoDisposicionFinalLote = {
  dispuestas: { id: string; radicado: string; requirioActa: boolean }[];
  omitidas: { id: string; motivo: string }[];
  actaId: string | null;
};

/**
 * Ejecuta la disposición final de una o varias comunicaciones a la vez según
 * lo que diga la TRD de cada una (MoReq 2.9: selección de expedientes vencidos
 * "individual o por lotes" — un lote de un solo elemento cubre el caso
 * individual). Las que exigen acta (eliminación/selección) comparten UNA sola
 * acta — el modelo ActaEliminacion.comunicaciones ya está pensado para un
 * lote. Las que no la exigen (conservación/microfilmación) solo quedan
 * marcadas con la fecha. La comunicación en sí NUNCA se borra de la base.
 */
export async function ejecutarDisposicionFinalLote(entrada: EntradaDisposicionFinalLote): Promise<ResultadoDisposicionFinalLote> {
  const comunicaciones = await db.comunicacion.findMany({
    where: { id: { in: entrada.comunicacionIds } },
    select: {
      id: true, radicado: true, fechaDisposicionFinal: true, subserie: { select: { disposicionesFinal: true } },
      expedienteId: true, expedienteDocumentalId: true,
      expediente: { select: { numero: true } },
      expedienteDocumental: { select: { numero: true } },
    },
  });
  const porId = new Map(comunicaciones.map((c) => [c.id, c]));

  const idsSinActa: string[] = [];
  const idsConActa: string[] = [];
  const omitidas: { id: string; motivo: string }[] = [];

  for (const id of entrada.comunicacionIds) {
    const c = porId.get(id);
    if (!c) { omitidas.push({ id, motivo: "No existe." }); continue; }
    if (c.fechaDisposicionFinal) { omitidas.push({ id, motivo: `${c.radicado}: ya tiene disposición final ejecutada.` }); continue; }
    const disposiciones = c.subserie?.disposicionesFinal ?? [];
    if (disposiciones.length === 0) { omitidas.push({ id, motivo: `${c.radicado}: su subserie no tiene disposición final definida en la TRD.` }); continue; }
    // MoReq 2.13: no destruir (eliminación/selección) una comunicación que sigue archivada dentro de un
    // expediente — el expediente quedaría con una referencia rota. Conservación/microfilmación sí proceden
    // (no destruyen nada), por eso este chequeo va solo dentro de la rama que exige acta.
    if (algunaRequiereActa(disposiciones)) {
      const numeroExpediente = c.expediente?.numero ?? c.expedienteDocumental?.numero;
      if (numeroExpediente) {
        omitidas.push({ id, motivo: `${c.radicado}: está archivada en el expediente ${numeroExpediente} — no se puede eliminar/seleccionar mientras siga ahí.` });
        continue;
      }
      idsConActa.push(id);
    } else {
      idsSinActa.push(id);
    }
  }

  if (idsConActa.length > 0 && !entrada.responsable.trim()) {
    throw new Error("Hay comunicaciones seleccionadas cuya disposición (eliminación/selección) exige indicar quién la aprueba.");
  }

  let actaId: string | null = null;
  await db.$transaction(async (tx) => {
    if (idsSinActa.length > 0) {
      await tx.comunicacion.updateMany({ where: { id: { in: idsSinActa } }, data: { fechaDisposicionFinal: new Date() } });
    }
    if (idsConActa.length > 0) {
      const acta = await tx.actaEliminacion.create({
        data: {
          responsable: entrada.responsable.trim(),
          motivacion: entrada.motivacion?.trim() || null,
          aprobadaPorId: entrada.aprobadaPorId ?? null,
          comunicaciones: { connect: idsConActa.map((id) => ({ id })) },
        },
      });
      actaId = acta.id;
      await tx.comunicacion.updateMany({ where: { id: { in: idsConActa } }, data: { fechaDisposicionFinal: new Date() } });
    }
  });

  const dispuestas = [
    ...idsSinActa.map((id) => ({ id, radicado: porId.get(id)!.radicado, requirioActa: false })),
    ...idsConActa.map((id) => ({ id, radicado: porId.get(id)!.radicado, requirioActa: true })),
  ];
  return { dispuestas, omitidas, actaId };
}
