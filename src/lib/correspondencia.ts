import { db } from "@/lib/db";
import type { MedioComunicacion, OrigenComunicacion, TipoPQRSD, TipoSolicitante, Prisma, NivelAccesoInformacion, EstadoComunicacion } from "@prisma/client";
import { generarRadicado } from "@/lib/radicado";
import { hashContenidoFirma } from "@/lib/firma";
import { resolverFirma } from "@/lib/firma-proveedor";
import { solicitarSelloTiempo } from "@/lib/sello-tiempo";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { TERMINO_DIAS_HABILES, calcularVencimiento, calcularVencimientoTrasReactivar, devolucionDeReparoPermitida } from "@/lib/pqrsd";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { algunaRequiereActa } from "@/lib/disposicion-final";
import { validarPalabrasClave } from "@/lib/vocabulario";
import { generarNumeroExpediente } from "@/lib/expedientes-documentales";

export type EntradaTercero = {
  tipo: TipoSolicitante;
  tipoIdentificacion?: string | null;
  identificacion?: string | null;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  municipio?: string | null;
  departamento?: string | null;
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
  contenido?: string | null;
  folios: number;
  anexosDescripcion?: string | null;
  medio?: MedioComunicacion | null;
  origen?: OrigenComunicacion | null;
  tercero: EntradaTercero;
  dependenciaDestinoId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  tipoPqrsd?: TipoPQRSD | null;
  documentos?: EntradaDocumento[];
  radicadoPorId: string | null;
};

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
      departamento: tercero.departamento?.trim() || null,
    },
    update: {
      email: tercero.email ?? undefined,
      telefono: tercero.telefono ?? undefined,
      direccion: tercero.direccion ?? undefined,
      departamento: tercero.departamento?.trim() || undefined,
    },
  });
  return solicitante.id;
}

function validarClasificacionTrd(serieId?: string | null, subserieId?: string | null) {
  if (serieId && !subserieId) {
    throw new Error("Elija también la subserie: una serie sin subserie deja la clasificación TRD incompleta.");
  }
  if (subserieId && !serieId) throw new Error("Falta la serie de la subserie elegida.");
}

export async function radicarRecibida(entrada: EntradaRadicacionRecibida) {
  validarClasificacionTrd(entrada.serieId, entrada.subserieId);
  const calendario = entrada.tipoPqrsd ? await getCalendarioLaboral() : undefined;
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("RECIBIDA", new Date().getFullYear(), tx);
    const ident = entrada.tercero.identificacion?.trim() || null;
    const muni = entrada.tercero.municipio?.trim() || null;
    const terceroId = await resolverOCrearTercero(tx, entrada.tercero);
    const fechaRadicacion = new Date();
    const terminoDiasHabiles = entrada.tipoPqrsd ? TERMINO_DIAS_HABILES[entrada.tipoPqrsd] : null;
    const fechaVencimiento = entrada.tipoPqrsd ? calcularVencimiento(fechaRadicacion, entrada.tipoPqrsd, calendario) : null;

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
        terceroDepartamento: entrada.tercero.departamento?.trim() || null,
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

const SELLO_INTERNO = "Bitácora encadenada del SGDEA (SHA-256)";

async function firmarEnTransaccion(
  tx: Prisma.TransactionClient,
  datos: { comunicacionId: string; usuarioId: string; radicado: string; asunto: string; contenido: string | null }
) {
  const fechaHora = new Date();
  const hashContenido = hashContenidoFirma({ radicado: datos.radicado, asunto: datos.asunto, contenido: datos.contenido, fechaIso: fechaHora.toISOString() });
  await tx.firma.create({
    data: {
      usuarioId: datos.usuarioId,
      comunicacionId: datos.comunicacionId,
      fechaHora,
      hashContenido,
      tipo: "ELECTRONICA_HASH",
      proveedor: "interno",
      formato: "hash-sha256",
      selloTiempoEn: fechaHora,
      selloTiempoFuente: SELLO_INTERNO,
    },
  });
}

export async function sellarFirmasConTsa(comunicacionId: string) {
  const config = await getConfiguracionSitio();
  const tsaUrl = config.selloTiempoTsaUrl?.trim();
  if (!tsaUrl) return;
  const firmas = await db.firma.findMany({
    where: { comunicacionId, selloTiempoToken: null },
    select: { id: true, hashContenido: true },
  });
  for (const f of firmas) {
    const sello = await solicitarSelloTiempo(f.hashContenido, tsaUrl);
    if (sello) {
      await db.firma.update({
        where: { id: f.id },
        data: { selloTiempoEn: sello.tiempo, selloTiempoFuente: tsaUrl, selloTiempoToken: sello.token },
      });
    }
  }
}

export async function agregarCofirma(comunicacionId: string, usuarioId: string, ip: string | null, userAgent: string | null = null) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, tipo: true, estado: true, radicado: true, asunto: true, contenido: true, firmas: { select: { usuarioId: true } } },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.tipo === "RECIBIDA") throw new Error("Una comunicación recibida no se firma: no tiene un contenido redactado por la Corporación.");
  if (c.estado === "ANULADA") throw new Error("No se puede firmar una comunicación anulada.");
  if (c.firmas.some((f) => f.usuarioId === usuarioId)) throw new Error("Usted ya firmó esta comunicación.");
  const fechaHora = new Date();
  const hashContenido = hashContenidoFirma({ radicado: c.radicado, asunto: c.asunto, contenido: c.contenido, fechaIso: fechaHora.toISOString() });
  const datos = await resolverFirma(hashContenido);
  return db.firma.create({
    data: {
      usuarioId,
      comunicacionId,
      fechaHora,
      hashContenido,
      tipo: "ELECTRONICA_HASH",
      ip,
      userAgent,
      proveedor: datos.proveedor,
      formato: datos.formato,
      selloTiempoEn: datos.selloTiempoEn,
      selloTiempoFuente: datos.selloTiempoFuente,
      selloTiempoToken: datos.selloTiempoToken,
    },
  });
}

export async function firmarEnLote(comunicacionIds: string[], usuarioId: string, ip: string | null) {
  const ids = [...new Set(comunicacionIds.filter(Boolean))].slice(0, 100);
  if (ids.length === 0) throw new Error("No se seleccionó ninguna comunicación.");
  const firmadas: string[] = [];
  const omitidas: { radicado: string; motivo: string }[] = [];
  for (const id of ids) {
    try {
      const c = await agregarCofirma(id, usuarioId, ip);
      const rad = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
      firmadas.push(rad?.radicado ?? id);
      void c;
    } catch (err) {
      const rad = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
      omitidas.push({ radicado: rad?.radicado ?? id, motivo: err instanceof Error ? err.message : "error" });
    }
  }
  return { firmadas, omitidas };
}

export async function comunicacionesFirmablesPor(usuarioId: string) {
  return db.comunicacion.findMany({
    where: {
      tipo: { in: ["ENVIADA", "INTERNA"] },
      estado: { notIn: ["ANULADA"] },
      firmas: { none: { usuarioId } },
    },
    orderBy: { fechaRadicacion: "desc" },
    take: 50,
    select: { id: true, radicado: true, asunto: true, tipo: true, fechaRadicacion: true },
  });
}

export type EntradaRadicacionEnviada = {
  asunto: string;
  contenido: string;
  folios: number;
  anexosDescripcion?: string | null;
  medio?: MedioComunicacion | null;
  destinatario: EntradaTercero;
  dependenciaOrigenId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  respondeAId?: string | null;
  documentos?: EntradaDocumento[];
  radicadoPorId: string;
};

export async function radicarEnviada(entrada: EntradaRadicacionEnviada) {
  validarClasificacionTrd(entrada.serieId, entrada.subserieId);
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("ENVIADA", new Date().getFullYear(), tx);
    const ident = entrada.destinatario.identificacion?.trim() || null;
    const muni = entrada.destinatario.municipio?.trim() || null;
    const terceroId = await resolverOCrearTercero(tx, entrada.destinatario);

    let documentosRespuestaFuncionario: EntradaDocumento[] = [];
    if (entrada.respondeAId) {
      const original = await tx.comunicacion.findUnique({ where: { id: entrada.respondeAId }, select: { id: true, tipo: true } });
      if (!original || original.tipo !== "RECIBIDA") throw new Error("La comunicación a la que responde no existe o no es una recibida.");
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
        terceroDepartamento: entrada.destinatario.departamento?.trim() || null,
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
  }).then(async (comunicacion) => {
    await sellarFirmasConTsa(comunicacion.id).catch(() => {});
    return comunicacion;
  });
}

export type EntradaRadicacionInterna = {
  asunto: string;
  contenido: string;
  folios: number;
  dependenciaOrigenId: string;
  dependenciaDestinoId: string;
  usuarioDestinoId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  documentos?: EntradaDocumento[];
  radicadoPorId: string;
};

export async function radicarInterna(entrada: EntradaRadicacionInterna) {
  validarClasificacionTrd(entrada.serieId, entrada.subserieId);
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("INTERNA", new Date().getFullYear(), tx);

    const comunicacion = await tx.comunicacion.create({
      data: {
        tipo: "INTERNA",
        radicado,
        anio,
        origen: "VENTANILLA",
        estado: entrada.usuarioDestinoId ? "ASIGNADA" : "RADICADA",
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

    if (entrada.usuarioDestinoId) {
      await tx.distribucion.create({
        data: {
          comunicacionId: comunicacion.id,
          dependenciaId: entrada.dependenciaDestinoId,
          usuarioId: entrada.usuarioDestinoId,
          asignadoPorId: entrada.radicadoPorId,
        },
      });
    }

    await crearDocumentos(tx, comunicacion.id, entrada.documentos, entrada.radicadoPorId);
    await firmarEnTransaccion(tx, { comunicacionId: comunicacion.id, usuarioId: entrada.radicadoPorId, radicado, asunto: entrada.asunto, contenido: entrada.contenido });

    return comunicacion;
  }).then(async (comunicacion) => {
    await sellarFirmasConTsa(comunicacion.id).catch(() => {});
    return comunicacion;
  });
}

export async function anularComunicacion(comunicacionId: string, motivo: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, estado: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado === "ANULADA") throw new Error("Esta comunicación ya está anulada.");
  if (!motivo.trim()) throw new Error("Debe indicar el motivo de la anulación.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { estado: "ANULADA", motivoAnulacion: motivo.trim() } });
}

export async function etiquetarComunicacion(comunicacionId: string, propuestas: string[]) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true } });
  if (!c) throw new Error("La comunicación no existe.");
  const { validas, rechazadas } = await validarPalabrasClave(propuestas);
  await db.comunicacion.update({ where: { id: comunicacionId }, data: { palabrasClave: validas } });
  return { validas, rechazadas };
}

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
  if (c._count.respuestas > 0) throw new Error("Ya se radicó una respuesta formal para esta comunicación.");
  if (!texto.trim()) throw new Error("Escriba el contenido de la respuesta.");

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

export async function devolverReparto(comunicacionId: string, usuarioId: string, motivo: string) {
  void usuarioId;
  if (!motivo.trim()) throw new Error("Indique por qué esta comunicación no le corresponde.");
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: {
      id: true, tipo: true, estado: true, radicado: true, fechaVencimiento: true,
      distribuciones: { where: { activa: true }, select: { id: true } },
    },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.tipo !== "RECIBIDA") throw new Error("Solo se devuelve el reparto de una comunicación recibida.");
  if (["RESPONDIDA", "ARCHIVADA", "ANULADA"].includes(c.estado)) throw new Error("El ciclo de esta comunicación ya está cerrado.");
  if (c.distribuciones.length === 0) throw new Error("Esta comunicación no tiene un reparto vigente que devolver.");
  const calendario = c.fechaVencimiento ? await getCalendarioLaboral() : undefined;
  if (!devolucionDeReparoPermitida(c.fechaVencimiento, calendario)) {
    throw new Error("No se puede devolver: faltan 3 días hábiles o menos para el vencimiento del término de ley. Atiéndala o coordínelo con la ventanilla.");
  }
  await db.$transaction([
    db.distribucion.updateMany({
      where: { comunicacionId, activa: true },
      data: { activa: false, devueltaEn: new Date(), motivoDevolucion: motivo.trim() },
    }),
    db.comunicacion.update({
      where: { id: comunicacionId },
      data: { estado: "EN_REPARTO", respuestaTexto: null, respuestaPorId: null, respuestaEn: null },
    }),
  ]);
  return { radicado: c.radicado };
}

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

export async function archivarEnExpediente(comunicacionId: string, expedienteId: string) {
  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { id: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { expedienteId } });
}

const ESTADOS_DETENIBLES: EstadoComunicacion[] = ["RADICADA", "EN_REPARTO", "ASIGNADA", "EN_TRAMITE"];

export async function suspenderTermino(comunicacionId: string, motivo: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, estado: true, tipo: true, fechaVencimiento: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.tipo !== "RECIBIDA") throw new Error("Solo una comunicación recibida en trámite se puede detener; una enviada o un memorando quedan definitivos al radicarse.");
  if (c.estado === "INFORMACION_ADICIONAL_REQUERIDA") throw new Error("El trámite ya está detenido.");
  if (!ESTADOS_DETENIBLES.includes(c.estado)) throw new Error("El trámite de esta comunicación ya está cerrado.");
  if (!motivo.trim()) throw new Error("Indique el motivo por el que se detiene el trámite.");
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: { estado: "INFORMACION_ADICIONAL_REQUERIDA", fechaSuspensionTermino: new Date(), motivoSuspension: motivo.trim() },
  });
}

export async function reactivarTermino(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, estado: true, fechaRadicacion: true, fechaSuspensionTermino: true, terminoDiasHabiles: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.estado !== "INFORMACION_ADICIONAL_REQUERIDA" || !c.fechaSuspensionTermino) {
    throw new Error("Esta comunicación no tiene un trámite detenido.");
  }
  let fechaVencimiento: Date | null = null;
  if (c.terminoDiasHabiles) {
    const calendario = await getCalendarioLaboral();
    fechaVencimiento = calcularVencimientoTrasReactivar(c.fechaRadicacion, c.fechaSuspensionTermino, new Date(), c.terminoDiasHabiles, calendario);
  }
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: {
      estado: "EN_TRAMITE",
      fechaSuspensionTermino: null,
      motivoSuspension: null,
      ...(fechaVencimiento ? { fechaVencimiento } : {}),
    },
  });
}

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

export async function transferirACentral(comunicacionId: string) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, transferidaCentralEn: true } });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.transferidaCentralEn) throw new Error("Ya fue transferida al archivo central.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { transferidaCentralEn: new Date() } });
}

export async function confirmarTransferenciaCentral(comunicacionId: string, usuarioId: string) {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { id: true, transferidaCentralEn: true, transferenciaConfirmadaEn: true },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (!c.transferidaCentralEn) throw new Error("Todavía no se ha registrado la transferencia al archivo central.");
  if (c.transferenciaConfirmadaEn) throw new Error("La recepción en archivo central ya fue confirmada.");
  return db.comunicacion.update({
    where: { id: comunicacionId },
    data: { transferenciaConfirmadaEn: new Date(), transferenciaConfirmadaPorId: usuarioId },
  });
}

export const MEDIOS_DESPACHO = ["CORREO_ELECTRONICO", "FISICO", "MENSAJERIA", "PERSONAL"] as const;
export type MedioDespacho = (typeof MEDIOS_DESPACHO)[number];

export const ETIQUETA_MEDIO_DESPACHO: Record<MedioDespacho, string> = {
  CORREO_ELECTRONICO: "Correo electrónico",
  FISICO: "Físico (correo postal / entrega)",
  MENSAJERIA: "Mensajería / correo certificado",
  PERSONAL: "Entrega personal",
};

export type EntradaDespacho = {
  comunicacionId: string;
  usuarioId: string;
  medio: string;
  destino?: string | null;
  observacion?: string | null;
  archivarEnExpediente: boolean;
};

export type ResultadoDespacho = {
  radicado: string;
  expedienteId: string | null;
  expedienteNumero: string | null;
  avisoExpediente: string | null;
};

export async function despacharComunicacion(entrada: EntradaDespacho): Promise<ResultadoDespacho> {
  const c = await db.comunicacion.findUnique({
    where: { id: entrada.comunicacionId },
    select: {
      id: true, tipo: true, estado: true, radicado: true, despachadaEn: true, asunto: true,
      serieId: true, subserieId: true, dependenciaOrigenId: true, expedienteDocumentalId: true,
      respondeAId: true,
      respondeA: { select: { id: true, asunto: true, dependenciaDestinoId: true, expedienteDocumentalId: true } },
      _count: { select: { firmas: true } },
    },
  });
  if (!c) throw new Error("La comunicación no existe.");
  if (c.tipo !== "ENVIADA") throw new Error("Solo se despacha un oficio de salida (comunicación enviada).");
  if (c.estado === "ANULADA") throw new Error("No se puede despachar una comunicación anulada.");
  if (c.despachadaEn) throw new Error("Este oficio ya fue despachado.");
  if (c._count.firmas === 0) throw new Error("El oficio debe estar firmado antes de despacharlo.");
  if (!(MEDIOS_DESPACHO as readonly string[]).includes(entrada.medio)) throw new Error("El medio de despacho no es válido.");

  const idsAArchivar = [c.id, ...(c.respondeAId ? [c.respondeAId] : [])];
  const expedienteExistente = c.expedienteDocumentalId ?? c.respondeA?.expedienteDocumentalId ?? null;
  const dependenciaExpediente = c.dependenciaOrigenId ?? c.respondeA?.dependenciaDestinoId ?? null;

  let avisoExpediente: string | null = null;
  let numeroNuevoExpediente: string | null = null;
  if (entrada.archivarEnExpediente && !expedienteExistente) {
    if (!dependenciaExpediente) {
      avisoExpediente = "No se creó expediente: el oficio no tiene dependencia de origen. Archívelo a mano desde el detalle.";
    } else {
      numeroNuevoExpediente = await generarNumeroExpediente();
    }
  }

  let expedienteId: string | null = null;
  let expedienteNumero: string | null = null;

  await db.$transaction(async (tx) => {
    await tx.comunicacion.update({
      where: { id: c.id },
      data: {
        despachadaEn: new Date(),
        despachadaPorId: entrada.usuarioId,
        despachoMedio: entrada.medio,
        despachoDestino: entrada.destino?.trim() || null,
        despachoObservacion: entrada.observacion?.trim() || null,
      },
    });

    if (!entrada.archivarEnExpediente) return;

    if (expedienteExistente) {
      const exp = await tx.expedienteDocumental.findUnique({
        where: { id: expedienteExistente },
        select: { id: true, numero: true, estado: true },
      });
      if (exp && exp.estado === "ABIERTO") {
        await tx.comunicacion.updateMany({
          where: { id: { in: idsAArchivar }, expedienteDocumentalId: null },
          data: { expedienteDocumentalId: exp.id },
        });
        expedienteId = exp.id;
        expedienteNumero = exp.numero;
      } else {
        avisoExpediente = "El expediente donde ya estaba archivada está cerrado — no se archivó la respuesta ahí.";
      }
    } else if (numeroNuevoExpediente && dependenciaExpediente) {
      const nuevo = await tx.expedienteDocumental.create({
        data: {
          numero: numeroNuevoExpediente,
          asunto: (c.respondeA?.asunto ?? c.asunto).slice(0, 500),
          dependenciaId: dependenciaExpediente,
          serieId: c.serieId,
          subserieId: c.subserieId,
          creadoPorId: entrada.usuarioId,
        },
      });
      await tx.comunicacion.updateMany({
        where: { id: { in: idsAArchivar } },
        data: { expedienteDocumentalId: nuevo.id },
      });
      expedienteId = nuevo.id;
      expedienteNumero = nuevo.numero;
    }
  });

  return { radicado: c.radicado, expedienteId, expedienteNumero, avisoExpediente };
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

export async function ejecutarDisposicionFinalLote(entrada: EntradaDisposicionFinalLote): Promise<ResultadoDisposicionFinalLote> {
  const comunicaciones = await db.comunicacion.findMany({
    where: { id: { in: entrada.comunicacionIds } },
    select: {
      id: true, radicado: true, fechaDisposicionFinal: true, subserie: { select: { disposicionesFinal: true } },
      expedienteId: true, expedienteDocumentalId: true,
      transferidaCentralEn: true, transferenciaConfirmadaEn: true,
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
    if (c.transferidaCentralEn && !c.transferenciaConfirmadaEn) {
      omitidas.push({ id, motivo: `${c.radicado}: transferida al archivo central pero sin confirmar la recepción — se conserva hasta confirmar que el proceso concluyó.` });
      continue;
    }
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
