import crypto from "crypto";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { resolverFirma } from "@/lib/firma-proveedor";
import { parsePorPagina } from "@/lib/vista-lista";
import type { PermisosUsuario } from "@/lib/permisos";
import type { EtapaContratacion, ModalidadSeleccion, RolContratacion, Prisma } from "@prisma/client";

/**
 * Módulo de Contratación — manejador de expedientes digitales de contratación
 * (Manual de Contratación y de Supervisión o Interventoría A-BS-MA01).
 * Deliberadamente aislado de Trámites 2.0 y del SGDEA de Correspondencia: no
 * es un ERP de contratación (no reemplaza SECOP II, no valida cuantías ni
 * reglas jurídicas de cada modalidad de selección).
 */

const SERIE_CONTRATO = "CTO";

export const ETAPAS_ORDEN: EtapaContratacion[] = ["PRECONTRACTUAL", "CONTRACTUAL", "POSTCONTRACTUAL"];

export const ETIQUETA_ETAPA: Record<EtapaContratacion, string> = {
  PRECONTRACTUAL: "Precontractual",
  CONTRACTUAL: "Contractual",
  POSTCONTRACTUAL: "Postcontractual",
};

export const ETIQUETA_MODALIDAD: Record<ModalidadSeleccion, string> = {
  LICITACION_PUBLICA: "Licitación pública",
  SELECCION_ABREVIADA_MENOR_CUANTIA: "Selección abreviada — menor cuantía",
  SELECCION_ABREVIADA_SUBASTA_INVERSA: "Selección abreviada — subasta inversa",
  SELECCION_ABREVIADA_ENAJENACION_BIENES: "Selección abreviada — enajenación de bienes",
  CONCURSO_MERITOS: "Concurso de méritos",
  CONTRATACION_DIRECTA: "Contratación directa",
  MINIMA_CUANTIA: "Mínima cuantía",
  CONVENIO_ASOCIACION: "Convenio de asociación (ESAL)",
  ARRENDAMIENTO: "Arrendamiento de inmuebles",
  OTRA: "Otra modalidad",
};

export const ETIQUETA_ROL_CONTRATACION: Record<RolContratacion, string> = {
  ADMINISTRADOR_CONTRATACION: "Administrador de Contratación",
  JEFE_CONTRATACION: "Jefe de Contratación",
  SUPERVISOR_INTERVENTOR: "Supervisor / Interventor",
  CONTRATISTA: "Contratista",
};

/** Orden de despliegue en los formularios: Contratación directa primero por ser, con
 * amplio margen, la modalidad más usada en la CDMB (pedido explícito del usuario). */
export const ORDEN_MODALIDADES: ModalidadSeleccion[] = [
  "CONTRATACION_DIRECTA",
  "MINIMA_CUANTIA",
  "SELECCION_ABREVIADA_MENOR_CUANTIA",
  "SELECCION_ABREVIADA_SUBASTA_INVERSA",
  "SELECCION_ABREVIADA_ENAJENACION_BIENES",
  "CONCURSO_MERITOS",
  "LICITACION_PUBLICA",
  "CONVENIO_ASOCIACION",
  "ARRENDAMIENTO",
  "OTRA",
];

export async function generarNumeroExpedienteContractual(anio: number = new Date().getFullYear()): Promise<string> {
  const { numero } = await generarConsecutivo(SERIE_CONTRATO, anio);
  return formatearRadicado(SERIE_CONTRATO, anio, numero);
}

/** Requisitos del catálogo (data/contratacion/requisitos.json, sembrado con
 * prisma/seed-contratacion.ts) que aplican a un expediente en UNA etapa: los
 * comunes a cualquier modalidad (modalidadSeleccion=null) más los propios de
 * la modalidad de ESTE expediente, en el orden del Manual. */
export async function obtenerRequisitosDeEtapa(modalidad: ModalidadSeleccion, etapa: EtapaContratacion) {
  return db.requisitoDocumentoContratacion.findMany({
    where: { etapa, activo: true, OR: [{ modalidadSeleccion: null }, { modalidadSeleccion: modalidad }] },
    orderBy: { orden: "asc" },
  });
}

export type ItemChecklist = Awaited<ReturnType<typeof obtenerRequisitosDeEtapa>>[number] & {
  documento:
    | {
        id: string;
        nombre: string;
        mimeType: string;
        estadoValidacion: string;
        requiereFirma: boolean;
        firmadoEnSecop: boolean;
        createdAt: Date;
        subidoPorNombre: string;
        firmaFechaHora: Date | null;
        firmaFormato: string | null;
      }
    | null;
};

/** Cruza el catálogo de requisitos de una etapa con los documentos YA subidos a ese
 * expediente en esa etapa — un requisito puede tener 0 o 1 documento vinculado (si se
 * sube más de uno para el mismo requisito, se muestra el más reciente en el checklist;
 * los anteriores no se pierden, siguen en la lista general de documentos del expediente). */
export function cruzarChecklist(
  requisitos: Awaited<ReturnType<typeof obtenerRequisitosDeEtapa>>,
  documentos: {
    id: string;
    requisitoId: string | null;
    nombre: string;
    mimeType: string;
    estadoValidacion: string;
    requiereFirma: boolean;
    firmadoEnSecop: boolean;
    createdAt: Date;
    subidoPor: { nombre: string };
    firma: { fechaHora: Date; formato: string } | null;
  }[]
): ItemChecklist[] {
  return requisitos.map((r) => {
    const candidatos = documentos.filter((d) => d.requisitoId === r.id);
    const ultimo = candidatos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    return {
      ...r,
      documento: ultimo
        ? {
            id: ultimo.id,
            nombre: ultimo.nombre,
            mimeType: ultimo.mimeType,
            estadoValidacion: ultimo.estadoValidacion,
            requiereFirma: ultimo.requiereFirma,
            firmadoEnSecop: ultimo.firmadoEnSecop,
            createdAt: ultimo.createdAt,
            subidoPorNombre: ultimo.subidoPor.nombre,
            firmaFechaHora: ultimo.firma?.fechaHora ?? null,
            firmaFormato: ultimo.firma?.formato ?? null,
          }
        : null,
    };
  });
}

/** Nombres de los requisitos OBLIGATORIOS de una etapa que todavía no tienen documento
 * subido — se usa para avisar (no bloquear, salvo la excepción del contratista) al
 * aprobar el paso de etapa. */
export function requisitosObligatoriosFaltantes(checklist: ItemChecklist[]): string[] {
  return checklist.filter((c) => c.obligatorio && !c.documento).map((c) => c.nombre);
}

/** Bitácora del módulo (mismo espíritu que ExpedienteEvento) — ver la EXCEPCIÓN
 * deliberada en permisos.ts (puedeEditarSinTrazaDocumentoContrato): la edición o
 * eliminación de un documento por Administrador/Jefe de Contratación NUNCA pasa
 * por esta función a propósito. Todo lo demás sí queda registrado. */
export async function registrarEventoContratacion(
  expedienteId: string,
  tipo: string,
  detalle: string | null,
  usuarioId: string | null
) {
  await db.eventoContratacion.create({ data: { expedienteId, tipo, detalle, usuarioId } });
}

export async function crearExpedienteContractual(datos: {
  objeto: string;
  modalidadSeleccion: ModalidadSeleccion;
  valor?: number | null;
  fechaInicio?: Date | null;
  fechaFinEstimada?: Date | null;
  dependenciaSolicitanteId: string;
  contratistaId?: string | null;
  supervisorUsuarioIds?: string[];
  creadoPorId: string;
}) {
  if (!datos.objeto.trim()) throw new Error("El objeto del contrato es obligatorio.");
  if (!datos.dependenciaSolicitanteId) throw new Error("Debe indicarse la dependencia solicitante.");

  const numero = await generarNumeroExpedienteContractual();
  const expediente = await db.expedienteContractual.create({
    data: {
      numero,
      objeto: datos.objeto.trim(),
      modalidadSeleccion: datos.modalidadSeleccion,
      valor: datos.valor ?? null,
      fechaInicio: datos.fechaInicio ?? null,
      fechaFinEstimada: datos.fechaFinEstimada ?? null,
      dependenciaSolicitanteId: datos.dependenciaSolicitanteId,
      contratistaId: datos.contratistaId || null,
      creadoPorId: datos.creadoPorId,
      etapas: { create: { etapa: "PRECONTRACTUAL" } },
      supervisores: datos.supervisorUsuarioIds?.length
        ? { create: datos.supervisorUsuarioIds.map((usuarioId) => ({ usuarioId })) }
        : undefined,
    },
  });

  await registrarEventoContratacion(expediente.id, "CREACION", `Expediente contractual creado: ${expediente.numero}`, datos.creadoPorId);
  return expediente;
}

export async function agregarDocumentoContrato(datos: {
  expedienteId: string;
  etapa: EtapaContratacion;
  categoria?: string | null;
  requisitoId?: string | null;
  nombre: string;
  storagePath: string;
  mimeType: string;
  tamanoBytes: number;
  hashSha256?: string | null;
  subidoPorId: string;
  requiereFirma?: boolean;
  firmadoEnSecop?: boolean;
}) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: datos.expedienteId },
    select: { cerrado: true, modalidadSeleccion: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");

  // Si el archivo se ata a un requisito del catálogo, el NOMBRE que queda guardado es
  // SIEMPRE el del procedimiento (nunca el nombre de archivo que mandó el cliente) —
  // nunca confiar solo en el cliente para algo que se usa en vistas previas, exportes y
  // la propia auditoría del expediente. También se valida que el requisito de verdad
  // aplique a la etapa y modalidad de ESTE expediente, para que no se pueda "colar" un
  // documento marcado como si perteneciera a otro requisito distinto.
  let nombre = datos.nombre.trim();
  let categoria = datos.categoria?.trim() || null;
  if (datos.requisitoId) {
    const requisito = await db.requisitoDocumentoContratacion.findUnique({ where: { id: datos.requisitoId } });
    if (!requisito || requisito.etapa !== datos.etapa || (requisito.modalidadSeleccion && requisito.modalidadSeleccion !== expediente.modalidadSeleccion)) {
      throw new Error("El requisito del catálogo indicado no corresponde a esta etapa/modalidad del expediente.");
    }
    nombre = requisito.nombre;
    categoria = null; // redundante: el nombre ya identifica el documento del catálogo
  }
  if (!nombre) throw new Error("El documento debe tener un nombre.");

  const documento = await db.documentoContrato.create({
    data: {
      expedienteId: datos.expedienteId,
      etapa: datos.etapa,
      categoria,
      requisitoId: datos.requisitoId || null,
      nombre,
      storagePath: datos.storagePath,
      mimeType: datos.mimeType,
      tamanoBytes: datos.tamanoBytes,
      hashSha256: datos.hashSha256 || null,
      subidoPorId: datos.subidoPorId,
      requiereFirma: Boolean(datos.requiereFirma),
      firmadoEnSecop: Boolean(datos.firmadoEnSecop),
    },
  });

  await registrarEventoContratacion(
    datos.expedienteId,
    "DOCUMENTO_SUBIDO",
    `Se subió "${nombre}" (${ETIQUETA_ETAPA[datos.etapa]})`,
    datos.subidoPorId
  );
  return documento;
}

/**
 * EXCEPCIÓN deliberada (ver permisos.ts `puedeEditarSinTrazaDocumentoContrato`):
 * edita metadata de un documento SIN escribir en EventoContratacion. Exclusivo
 * de Administrador/Jefe de Contratación — el gate se aplica en la ruta de API,
 * esta función asume que ya se validó.
 */
export async function editarDocumentoContratoSinTraza(
  documentoId: string,
  datos: { nombre?: string; categoria?: string | null; etapa?: EtapaContratacion; requiereFirma?: boolean; firmadoEnSecop?: boolean }
) {
  const nombre = datos.nombre?.trim();
  return db.documentoContrato.update({
    where: { id: documentoId },
    data: {
      ...(nombre ? { nombre } : {}),
      ...(datos.categoria !== undefined ? { categoria: datos.categoria?.trim() || null } : {}),
      ...(datos.etapa ? { etapa: datos.etapa } : {}),
      ...(datos.requiereFirma !== undefined ? { requiereFirma: datos.requiereFirma } : {}),
      ...(datos.firmadoEnSecop !== undefined ? { firmadoEnSecop: datos.firmadoEnSecop } : {}),
    },
  });
}

/**
 * EXCEPCIÓN deliberada, misma nota que editarDocumentoContratoSinTraza: borra
 * la fila (y el archivo del storage, best-effort) SIN dejar ninguna traza.
 * Devuelve el storagePath para que el caller (ruta de API) intente borrarlo del
 * bucket — mantener el borrado de Storage fuera de esta función de dominio para
 * no acoplarla a Supabase.
 */
export async function eliminarDocumentoContratoSinTraza(documentoId: string): Promise<{ storagePath: string }> {
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { storagePath: true } });
  if (!doc) throw new Error("El documento no existe.");
  await db.documentoContrato.delete({ where: { id: documentoId } });
  return { storagePath: doc.storagePath };
}

function hashContenidoFirmaDocumento(datos: { documentoId: string; nombre: string; hashSha256: string | null; fechaIso: string }): string {
  const base = [datos.documentoId, datos.nombre, datos.hashSha256 ?? "", datos.fechaIso].join("␟");
  return crypto.createHash("sha256").update(base, "utf8").digest("hex");
}

/** Revisa y aprueba un documento marcado `requiereFirma`: crea su FirmaDocumentoContrato
 * (hash + identidad + timestamp, mismo mecanismo ya validado en el SGDEA) y lo marca APROBADO. */
export async function firmarDocumentoContrato(documentoId: string, usuarioId: string) {
  const doc = await db.documentoContrato.findUnique({
    where: { id: documentoId },
    include: { firma: { select: { id: true } } },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.firma) throw new Error("Este documento ya tiene una firma registrada.");
  if (!doc.requiereFirma) throw new Error("Este documento no fue marcado como que requiere firma electrónica.");
  if (doc.firmadoEnSecop) throw new Error("Este documento ya viene firmado/publicado en SECOP II — no requiere firma interna.");

  const fechaIso = new Date().toISOString();
  const hashContenido = hashContenidoFirmaDocumento({ documentoId: doc.id, nombre: doc.nombre, hashSha256: doc.hashSha256, fechaIso });
  const resuelto = await resolverFirma(hashContenido);

  await db.$transaction([
    db.firmaDocumentoContrato.create({
      data: {
        documentoId: doc.id,
        usuarioId,
        hashContenido,
        proveedor: resuelto.proveedor,
        formato: resuelto.formato,
        selloTiempoEn: resuelto.selloTiempoEn,
        selloTiempoFuente: resuelto.selloTiempoFuente,
        selloTiempoToken: resuelto.selloTiempoToken,
      },
    }),
    db.documentoContrato.update({
      where: { id: doc.id },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    }),
  ]);

  await registrarEventoContratacion(doc.expedienteId, "DOCUMENTO_FIRMADO", `Se firmó "${doc.nombre}"`, usuarioId);
}

export async function rechazarDocumentoContrato(documentoId: string, usuarioId: string, comentario: string) {
  if (!comentario.trim()) throw new Error("Indique por qué se rechaza el documento.");
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { id: true, nombre: true, expedienteId: true } });
  if (!doc) throw new Error("El documento no existe.");

  await db.documentoContrato.update({
    where: { id: documentoId },
    data: { estadoValidacion: "RECHAZADO", validadoPorId: usuarioId, validadoEn: new Date(), comentarioValidacion: comentario.trim() },
  });
  await registrarEventoContratacion(doc.expedienteId, "DOCUMENTO_RECHAZADO", `Se rechazó "${doc.nombre}": ${comentario.trim()}`, usuarioId);
}

/** Error específico: la etapa que se quiere cerrar tiene documentos obligatorios del
 * catálogo sin subir. No bloquea la aprobación (el módulo es un manejador de
 * expedientes, no un motor de validación jurídica) — el caller decide si reintenta
 * con `forzar=true` tras mostrarle la lista al usuario. */
export class FaltanRequisitosError extends Error {
  constructor(public readonly faltantes: string[]) {
    super(`Faltan ${faltantes.length} documento(s) obligatorio(s) de esta etapa: ${faltantes.join("; ")}`);
    this.name = "FaltanRequisitosError";
  }
}

/** Aprueba el paso de la etapa actual a la siguiente (o cierra el expediente si ya
 * estaba en Postcontractual) — el Jefe de Contratación valida cada transición
 * (Cap. 6/7/10 del Manual), sin crear un expediente nuevo por etapa.
 *
 * Dos controles del checklist real (pedido explícito del usuario):
 * 1. Nunca se pasa de Precontractual a Contractual sin conocer al contratista
 *    (persona natural o jurídica) — bloqueo DURO, sin `forzar` que lo salte.
 * 2. Si a la etapa que se cierra le faltan documentos OBLIGATORIOS del catálogo,
 *    se avisa (FaltanRequisitosError) en vez de aprobar directo; con `forzar=true`
 *    se aprueba de todas formas (el catálogo es una guía, no una camisa de fuerza).
 */
export async function aprobarEtapaContratacion(
  expedienteId: string,
  usuarioId: string,
  comentario?: string | null,
  forzar = false
) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { etapaActual: true, cerrado: true, modalidadSeleccion: true, contratistaId: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente ya está cerrado.");

  if (expediente.etapaActual === "PRECONTRACTUAL" && !expediente.contratistaId) {
    throw new Error(
      "No se puede pasar a la etapa Contractual sin conocer al contratista (persona natural o jurídica). Vincúlelo primero desde el expediente."
    );
  }

  if (!forzar) {
    const requisitos = await obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, expediente.etapaActual);
    const documentos = await db.documentoContrato.findMany({
      where: { expedienteId, etapa: expediente.etapaActual },
      select: {
        id: true,
        requisitoId: true,
        nombre: true,
        mimeType: true,
        estadoValidacion: true,
        requiereFirma: true,
        firmadoEnSecop: true,
        createdAt: true,
        subidoPor: { select: { nombre: true } },
        firma: { select: { fechaHora: true, formato: true } },
      },
    });
    const faltantes = requisitosObligatoriosFaltantes(cruzarChecklist(requisitos, documentos));
    if (faltantes.length > 0) throw new FaltanRequisitosError(faltantes);
  }

  const idx = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  await db.etapaExpedienteContractual.upsert({
    where: { expedienteId_etapa: { expedienteId, etapa: expediente.etapaActual } },
    update: { completadaEn: new Date(), aprobadaPorId: usuarioId, comentario: comentario?.trim() || null },
    create: {
      expedienteId,
      etapa: expediente.etapaActual,
      completadaEn: new Date(),
      aprobadaPorId: usuarioId,
      comentario: comentario?.trim() || null,
    },
  });

  if (idx === ETAPAS_ORDEN.length - 1) {
    await db.expedienteContractual.update({ where: { id: expedienteId }, data: { cerrado: true, fechaCierre: new Date() } });
    await registrarEventoContratacion(expedienteId, "EXPEDIENTE_CERRADO", "Se cerró el expediente contractual (fin de Postcontractual).", usuarioId);
    return;
  }

  const siguiente = ETAPAS_ORDEN[idx + 1]!;
  await db.expedienteContractual.update({ where: { id: expedienteId }, data: { etapaActual: siguiente } });
  await db.etapaExpedienteContractual.upsert({
    where: { expedienteId_etapa: { expedienteId, etapa: siguiente } },
    update: {},
    create: { expedienteId, etapa: siguiente },
  });
  await registrarEventoContratacion(
    expedienteId,
    "ETAPA_APROBADA",
    `Se aprobó el paso de ${ETIQUETA_ETAPA[expediente.etapaActual]} a ${ETIQUETA_ETAPA[siguiente]}.`,
    usuarioId
  );
}

/** Retrocede el expediente a la etapa inmediatamente anterior — corrige un avance
 * hecho por error (pedido explícito del usuario: "si me equivoqué... no me deja
 * regresar"). Reabre la etapa anterior (limpia completadaEn/aprobadaPorId) y, si el
 * expediente ya estaba cerrado, lo reabre. Administrador o Jefe de Contratación. */
export async function retrocederEtapaContratacion(expedienteId: string, usuarioId: string, motivo: string) {
  if (!motivo.trim()) throw new Error("Indique el motivo para retroceder de etapa.");
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { etapaActual: true, cerrado: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");

  const idxEfectivo = expediente.cerrado ? ETAPAS_ORDEN.length - 1 : ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  if (idxEfectivo === 0) throw new Error("El expediente ya está en la primera etapa (Precontractual).");

  const anterior = ETAPAS_ORDEN[idxEfectivo - 1]!;
  await db.expedienteContractual.update({
    where: { id: expedienteId },
    data: { etapaActual: anterior, cerrado: false, fechaCierre: null },
  });
  await db.etapaExpedienteContractual.upsert({
    where: { expedienteId_etapa: { expedienteId, etapa: anterior } },
    update: { completadaEn: null, aprobadaPorId: null },
    create: { expedienteId, etapa: anterior },
  });
  await registrarEventoContratacion(
    expedienteId,
    "ETAPA_RETROCEDIDA",
    `Se retrocedió de ${expediente.cerrado ? "Cerrado" : ETIQUETA_ETAPA[expediente.etapaActual]} a ${ETIQUETA_ETAPA[anterior]}: ${motivo.trim()}`,
    usuarioId
  );
}

/** Elimina COMPLETAMENTE un expediente contractual (documentos, etapas, eventos y
 * firmas asociadas, por cascada) — incluso si está cerrado. Reservado al
 * Administrador de Contratación (ver puedeEliminarExpedienteContractual); decisión
 * explícita del usuario, más severa que la excepción de borrado de un solo
 * documento. Devuelve las rutas de storage de los documentos para que el caller
 * intente borrarlas del bucket (best-effort, fuera de esta función de dominio). */
export async function eliminarExpedienteContractualCompleto(expedienteId: string): Promise<{ storagePaths: string[] }> {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { documentos: { select: { storagePath: true } } },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  const storagePaths = expediente.documentos.map((d) => d.storagePath);
  await db.expedienteContractual.delete({ where: { id: expedienteId } });
  return { storagePaths };
}

/** Vincula (o crea) el Contratista asociado a un Usuario con rolContratacion=CONTRATISTA —
 * mismo patrón que el upsert de Solicitante por identificación en Trámites 2.0. Se busca
 * primero por usuarioId (ya vinculado, solo actualiza datos) y luego por identificación
 * (contratista ya existía sin cuenta, se le vincula la cuenta de dominio recién asignada). */
export async function vincularContratistaAUsuario(
  usuarioId: string,
  datos: { identificacion: string; nombreORazonSocial?: string; tipoPersona?: "NATURAL" | "JURIDICA" }
) {
  const identificacion = datos.identificacion.trim();
  if (!identificacion) throw new Error("Indique la identificación (NIT/cédula) del contratista.");

  const existentePorUsuario = await db.contratista.findUnique({ where: { usuarioId } });
  if (existentePorUsuario) {
    return db.contratista.update({
      where: { id: existentePorUsuario.id },
      data: {
        identificacion,
        ...(datos.nombreORazonSocial ? { nombreORazonSocial: datos.nombreORazonSocial.trim() } : {}),
        ...(datos.tipoPersona ? { tipoPersona: datos.tipoPersona } : {}),
      },
    });
  }

  const existentePorIdentificacion = await db.contratista.findUnique({ where: { identificacion } });
  if (existentePorIdentificacion) {
    if (existentePorIdentificacion.usuarioId && existentePorIdentificacion.usuarioId !== usuarioId) {
      throw new Error("Esa identificación ya está vinculada a otro usuario.");
    }
    return db.contratista.update({
      where: { id: existentePorIdentificacion.id },
      data: {
        usuarioId,
        ...(datos.nombreORazonSocial ? { nombreORazonSocial: datos.nombreORazonSocial.trim() } : {}),
        ...(datos.tipoPersona ? { tipoPersona: datos.tipoPersona } : {}),
      },
    });
  }

  return db.contratista.create({
    data: {
      identificacion,
      nombreORazonSocial: datos.nombreORazonSocial?.trim() || "(sin nombre registrado)",
      tipoPersona: datos.tipoPersona || "NATURAL",
      usuarioId,
    },
  });
}

/** Desvincula el Contratista de un usuario (ej. deja de tener el rol CONTRATISTA) sin
 * borrar el registro maestro — sus expedientes históricos siguen intactos. */
export async function desvincularContratistaDeUsuario(usuarioId: string) {
  await db.contratista.updateMany({ where: { usuarioId }, data: { usuarioId: null } });
}

export type FiltrosContratacion = {
  q?: string;
  etapa?: string;
  modalidad?: string;
  contratistaId?: string;
  dependenciaId?: string;
  page?: string;
  vista?: string;
};

/** Denegado por defecto por rol: Administrador/Jefe ven todos los expedientes;
 * Supervisor solo los suyos; Contratista solo el(los) propio(s). */
function restringirPorRolContratacion(permisos: PermisosUsuario): Prisma.ExpedienteContractualWhereInput {
  if (permisos.esAdmin || permisos.contratacion === "ADMINISTRADOR_CONTRATACION" || permisos.contratacion === "JEFE_CONTRATACION") {
    return {};
  }
  if (permisos.contratacion === "SUPERVISOR_INTERVENTOR") {
    return { id: { in: Array.from(permisos.supervisaExpedientes) } };
  }
  if (permisos.contratacion === "CONTRATISTA") {
    return { contratistaId: permisos.contratistaId ?? "__sin_contratista__" };
  }
  return { id: "__sin_acceso__" };
}

export function construirWhereExpedienteContractual(
  f: FiltrosContratacion,
  permisos: PermisosUsuario
): Prisma.ExpedienteContractualWhereInput {
  const and: Prisma.ExpedienteContractualWhereInput[] = [restringirPorRolContratacion(permisos)];
  if (f.etapa && (ETAPAS_ORDEN as string[]).includes(f.etapa)) and.push({ etapaActual: f.etapa as EtapaContratacion });
  if (f.modalidad) and.push({ modalidadSeleccion: f.modalidad as ModalidadSeleccion });
  if (f.dependenciaId) and.push({ dependenciaSolicitanteId: f.dependenciaId });
  if (f.contratistaId) and.push({ contratistaId: f.contratistaId });
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { numero: { contains: q, mode: "insensitive" } },
        { objeto: { contains: q, mode: "insensitive" } },
        { contratista: { nombreORazonSocial: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export async function listarExpedientesContractuales(filtro: FiltrosContratacion | undefined, permisos: PermisosUsuario) {
  const page = Math.max(1, parseInt(filtro?.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtro?.vista);
  const where = construirWhereExpedienteContractual(filtro ?? {}, permisos);

  const [total, filas] = await Promise.all([
    db.expedienteContractual.count({ where }),
    db.expedienteContractual.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * porPagina,
      take: porPagina,
      include: {
        dependenciaSolicitante: { select: { nombre: true } },
        contratista: { select: { nombreORazonSocial: true, identificacion: true } },
        _count: { select: { documentos: true } },
      },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista };
}
