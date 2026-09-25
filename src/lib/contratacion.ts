import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { parsePorPagina } from "@/lib/vista-lista";
import { calcularPeriodosInforme, esRequisitoPorPeriodos, nombreDocumentoPeriodo } from "@/lib/periodos-informe";
import { nombreInicialDesdeUsuarioRed } from "@/lib/nombre-usuario-red";
import { registrarAuditoria } from "@/lib/auditoria";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import type { PermisosUsuario } from "@/lib/permisos";
import type { EtapaContratacion, ModalidadSeleccion, RolContratacion, RolFirmante, EstadoSolicitudFirma, CalidadFirma, Prisma } from "@prisma/client";

export const TAG_CATALOGO_REQUISITOS = "catalogo-requisitos";

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
  FUNCIONARIO_CONTRATACION: "Funcionario de Contratación",
  JEFE_DEPENDENCIA: "Jefe de dependencia / Subdirector",
  SUPERVISOR_INTERVENTOR: "Supervisor / Interventor",
  CONTRATISTA: "Contratista",
};

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

export function identidadFirmante(u: {
  cedulaONit?: string | null;
  tipoIdentificacionFirma?: string | null;
  correoNotificacion?: string | null;
  contratista?: { identificacion: string; contactoEmail: string | null; tipoPersona?: string | null } | null;
}): { cedulaONit: string | null; tipoIdentificacion: string | null; correoNotificacion: string | null } {
  const tipoContratista = u.contratista?.tipoPersona === "JURIDICA" ? "NIT" : u.contratista?.tipoPersona === "NATURAL" ? "CC" : null;
  return {
    cedulaONit: u.cedulaONit ?? u.contratista?.identificacion ?? null,
    tipoIdentificacion: u.cedulaONit ? (u.tipoIdentificacionFirma ?? null) : u.contratista ? tipoContratista : null,
    correoNotificacion: u.correoNotificacion ?? u.contratista?.contactoEmail ?? null,
  };
}

export const obtenerRequisitosDeEtapa = unstable_cache(
  async (modalidad: ModalidadSeleccion, etapa: EtapaContratacion) => {
    return db.requisitoDocumentoContratacion.findMany({
      where: { etapa, activo: true, OR: [{ modalidadSeleccion: null }, { modalidadSeleccion: modalidad }] },
      orderBy: [{ obligatorio: "desc" }, { orden: "asc" }],
    });
  },
  ["requisitos-de-etapa"],
  { tags: [TAG_CATALOGO_REQUISITOS] }
);

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
        totalFirmas: number;
        solicitudesFirma: {
          id: string;
          rol: RolFirmante;
          orden: number;
          estado: EstadoSolicitudFirma;
          usuarioAsignadoId: string;
          usuarioAsignadoNombre: string;
          calidad: CalidadFirma | null;
        }[];
      }
    | null;
};

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
    firmas: { fechaHora: Date; formato: string }[];
    solicitudesFirma: {
      id: string;
      rol: RolFirmante;
      orden: number;
      estado: EstadoSolicitudFirma;
      usuarioAsignadoId: string;
      calidad?: CalidadFirma | null;
      usuarioAsignado: { nombre: string };
    }[];
  }[]
): ItemChecklist[] {
  return requisitos.map((r) => {
    const candidatos = documentos.filter((d) => d.requisitoId === r.id);
    const ultimo = candidatos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    const ultimaFirma = ultimo ? [...ultimo.firmas].sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime())[0] ?? null : null;
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
            firmaFechaHora: ultimaFirma?.fechaHora ?? null,
            firmaFormato: ultimaFirma?.formato ?? null,
            totalFirmas: ultimo.firmas.length,
            solicitudesFirma: ultimo.solicitudesFirma.map((s) => ({
              id: s.id,
              rol: s.rol,
              orden: s.orden,
              estado: s.estado,
              usuarioAsignadoId: s.usuarioAsignadoId,
              usuarioAsignadoNombre: s.usuarioAsignado.nombre,
              calidad: s.calidad ?? null,
            })),
          }
        : null,
    };
  });
}

export function requisitosObligatoriosFaltantes(checklist: ItemChecklist[]): string[] {
  return checklist.filter((c) => c.obligatorio && !c.documento).map((c) => c.nombre);
}

export async function listarCatalogoRequisitos() {
  return db.requisitoDocumentoContratacion.findMany({
    orderBy: [{ etapa: "asc" }, { modalidadSeleccion: { sort: "asc", nulls: "first" } }, { orden: "asc" }],
  });
}

export async function crearRequisitoCatalogo(datos: {
  etapa: EtapaContratacion;
  modalidadSeleccion?: ModalidadSeleccion | null;
  nombre: string;
  codigoFormato?: string | null;
  fuente?: string | null;
  obligatorio: boolean;
}) {
  if (!datos.nombre.trim()) throw new Error("El nombre del requisito es obligatorio.");
  const maximo = await db.requisitoDocumentoContratacion.aggregate({
    where: { etapa: datos.etapa, modalidadSeleccion: datos.modalidadSeleccion ?? null },
    _max: { orden: true },
  });
  return db.requisitoDocumentoContratacion.create({
    data: {
      etapa: datos.etapa,
      modalidadSeleccion: datos.modalidadSeleccion ?? null,
      orden: (maximo._max.orden ?? 0) + 1,
      nombre: datos.nombre.trim(),
      codigoFormato: datos.codigoFormato?.trim() || null,
      fuente: datos.fuente?.trim() || null,
      obligatorio: datos.obligatorio,
    },
  });
}

export async function actualizarRequisitoCatalogo(
  id: string,
  datos: Partial<{
    nombre: string;
    codigoFormato: string | null;
    fuente: string | null;
    notaOrigenExterno: string | null;
    modalidadSeleccion: ModalidadSeleccion | null;
    obligatorio: boolean;
    gestionadoEnSecop: boolean;
    activo: boolean;
  }>
) {
  return db.requisitoDocumentoContratacion.update({
    where: { id },
    data: { ...datos, nombre: datos.nombre?.trim() },
  });
}

export async function moverRequisitoCatalogo(id: string, direccion: "arriba" | "abajo") {
  const actual = await db.requisitoDocumentoContratacion.findUnique({ where: { id } });
  if (!actual) throw new Error("El requisito no existe.");

  const vecino = await db.requisitoDocumentoContratacion.findFirst({
    where: {
      etapa: actual.etapa,
      modalidadSeleccion: actual.modalidadSeleccion,
      orden: direccion === "arriba" ? { lt: actual.orden } : { gt: actual.orden },
    },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return actual;

  await db.$transaction([
    db.requisitoDocumentoContratacion.update({ where: { id: actual.id }, data: { orden: vecino.orden } }),
    db.requisitoDocumentoContratacion.update({ where: { id: vecino.id }, data: { orden: actual.orden } }),
  ]);
  return actual;
}

export async function eliminarRequisitoCatalogo(id: string) {
  const enUso = await db.documentoContrato.count({ where: { requisitoId: id } });
  if (enUso > 0) {
    throw new Error("Este requisito ya tiene documentos cargados — desactívelo en vez de eliminarlo.");
  }
  await db.requisitoDocumentoContratacion.delete({ where: { id } });
}

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
  numeroContrato?: string | null;
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
      numeroContrato: datos.numeroContrato?.trim() || null,
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
  periodoMes?: string | null;
  periodoEventualId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: datos.expedienteId },
    select: { cerrado: true, modalidadSeleccion: true, fechaInicio: true, fechaFinEstimada: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");

  let nombre = datos.nombre.trim();
  let categoria = datos.categoria?.trim() || null;
  if (datos.requisitoId) {
    const requisito = await db.requisitoDocumentoContratacion.findUnique({ where: { id: datos.requisitoId } });
    if (!requisito || requisito.etapa !== datos.etapa || (requisito.modalidadSeleccion && requisito.modalidadSeleccion !== expediente.modalidadSeleccion)) {
      throw new Error("El requisito del catálogo indicado no corresponde a esta etapa/modalidad del expediente.");
    }
    nombre = requisito.nombre;
    categoria = null;

    if (esRequisitoPorPeriodos(requisito)) {
      const periodoMes = datos.periodoMes?.trim() || null;
      const periodoEventualId = datos.periodoEventualId?.trim() || null;
      if (!periodoMes && !periodoEventualId) throw new Error(`"${requisito.nombre}" se entrega por periodos: indique a qué periodo corresponde.`);
      if (periodoMes && periodoEventualId) throw new Error("Un documento corresponde a un solo periodo.");

      if (periodoMes) {
        const periodos = calcularPeriodosInforme(expediente.fechaInicio, expediente.fechaFinEstimada);
        const idx = periodos.findIndex((p) => p.clave === periodoMes);
        if (idx < 0) throw new Error("Ese periodo no existe para las fechas de este contrato.");
        nombre = nombreDocumentoPeriodo(requisito.nombre, periodos[idx]!, idx + 1);
      } else {
        const eventual = await db.periodoInformeEventual.findFirst({ where: { id: periodoEventualId!, expedienteId: datos.expedienteId }, select: { nombre: true } });
        if (!eventual) throw new Error("El espacio eventual indicado no existe en este expediente.");
        nombre = `${requisito.nombre} — ${eventual.nombre}`;
      }
      const yaTiene = await db.documentoContrato.count({
        where: { expedienteId: datos.expedienteId, requisitoId: requisito.id, ...(periodoMes ? { periodoMes } : { periodoEventualId }) },
      });
      if (yaTiene > 0) throw new Error("Este periodo ya tiene un documento cargado: edítelo o elimínelo para cargar otro.");
    } else if (datos.periodoMes || datos.periodoEventualId) {
      throw new Error("Este requisito no se entrega por periodos.");
    }
  } else if (datos.periodoMes || datos.periodoEventualId) {
    throw new Error("Solo un documento del catálogo que se entrega por periodos puede asociarse a un periodo.");
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
      periodoMes: datos.periodoMes?.trim() || null,
      periodoEventualId: datos.periodoEventualId?.trim() || null,
    },
  });

  await registrarEventoContratacion(
    datos.expedienteId,
    "DOCUMENTO_SUBIDO",
    `Se subió "${nombre}" (${ETIQUETA_ETAPA[datos.etapa]})`,
    datos.subidoPorId
  );
  await registrarAuditoriaDoc({
    entidad: "DocumentoContrato",
    entidadId: documento.id,
    accion: "CREA",
    usuarioId: datos.subidoPorId,
    ip: datos.ip ?? null,
    userAgent: datos.userAgent ?? null,
    detalle: `Se subió "${nombre}" (${ETIQUETA_ETAPA[datos.etapa]}) al expediente`,
  });
  return documento;
}

export async function editarDocumentoContratoSinTraza(
  documentoId: string,
  datos: {
    nombre?: string;
    categoria?: string | null;
    etapa?: EtapaContratacion;
    requiereFirma?: boolean;
    firmadoEnSecop?: boolean;
    archivo?: { storagePath: string; mimeType: string; tamanoBytes: number; hashSha256: string | null };
  }
): Promise<{ storagePathAnterior: string | null }> {
  const nombre = datos.nombre?.trim();
  const anterior = datos.archivo
    ? await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { storagePath: true } })
    : null;
  if (datos.archivo && !anterior) throw new Error("El documento no existe.");

  await db.documentoContrato.update({
    where: { id: documentoId },
    data: {
      ...(nombre ? { nombre } : {}),
      ...(datos.categoria !== undefined ? { categoria: datos.categoria?.trim() || null } : {}),
      ...(datos.etapa ? { etapa: datos.etapa } : {}),
      ...(datos.requiereFirma !== undefined ? { requiereFirma: datos.requiereFirma } : {}),
      ...(datos.firmadoEnSecop !== undefined ? { firmadoEnSecop: datos.firmadoEnSecop } : {}),
      ...(datos.archivo
        ? {
            storagePath: datos.archivo.storagePath,
            mimeType: datos.archivo.mimeType,
            tamanoBytes: datos.archivo.tamanoBytes,
            hashSha256: datos.archivo.hashSha256,
            estadoValidacion: "PENDIENTE" as const,
            validadoPorId: null,
            validadoEn: null,
          }
        : {}),
    },
  });

  if (datos.archivo) {
    await db.firmaDocumentoContrato.deleteMany({ where: { documentoId } });
    await db.solicitudFirma.deleteMany({ where: { documentoContratoId: documentoId } });
    await db.avisoRechazoDocumento.deleteMany({ where: { documentoContratoId: documentoId } });
  }

  return { storagePathAnterior: anterior?.storagePath ?? null };
}

export async function eliminarDocumentoContratoSinTraza(documentoId: string): Promise<{ storagePath: string }> {
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { storagePath: true } });
  if (!doc) throw new Error("El documento no existe.");
  await db.documentoContrato.delete({ where: { id: documentoId } });
  return { storagePath: doc.storagePath };
}

export async function editarDocumentoContratoConTraza(
  documentoId: string,
  datos: Parameters<typeof editarDocumentoContratoSinTraza>[1],
  usuarioId: string,
  peticion?: { ip?: string | null; userAgent?: string | null }
): Promise<{ storagePathAnterior: string | null }> {
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { nombre: true, expedienteId: true } });
  if (!doc) throw new Error("El documento no existe.");
  const resultado = await editarDocumentoContratoSinTraza(documentoId, datos);
  const detalle = datos.archivo ? `Reemplazó el archivo de "${doc.nombre}"` : `Editó "${doc.nombre}"`;
  await registrarEventoContratacion(doc.expedienteId, "DOCUMENTO_EDITADO", detalle, usuarioId);
  await registrarAuditoriaDoc({
    entidad: "DocumentoContrato",
    entidadId: documentoId,
    accion: "MODIFICA",
    usuarioId,
    ip: peticion?.ip ?? null,
    userAgent: peticion?.userAgent ?? null,
    detalle,
  });
  return resultado;
}

export async function eliminarDocumentoContratoConTraza(
  documentoId: string,
  usuarioId: string,
  peticion?: { ip?: string | null; userAgent?: string | null }
): Promise<{ storagePath: string }> {
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { nombre: true, expedienteId: true } });
  if (!doc) throw new Error("El documento no existe.");
  const resultado = await eliminarDocumentoContratoSinTraza(documentoId);
  await registrarEventoContratacion(doc.expedienteId, "DOCUMENTO_ELIMINADO", `Eliminó "${doc.nombre}"`, usuarioId);
  await registrarAuditoriaDoc({
    entidad: "DocumentoContrato",
    entidadId: documentoId,
    accion: "ELIMINA",
    usuarioId,
    ip: peticion?.ip ?? null,
    userAgent: peticion?.userAgent ?? null,
    detalle: `Eliminó "${doc.nombre}"`,
  });
  return resultado;
}

export async function validarDocumentoContrato(
  documentoId: string,
  usuarioId: string,
  opts: { sinTraza: boolean; ip?: string | null; userAgent?: string | null }
): Promise<void> {
  const doc = await db.documentoContrato.findUnique({
    where: { id: documentoId },
    select: { nombre: true, expedienteId: true, estadoValidacion: true },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.estadoValidacion === "APROBADO") throw new Error("Este documento ya está validado.");

  await db.documentoContrato.update({
    where: { id: documentoId },
    data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
  });

  if (opts.sinTraza) return;
  const detalle = `Validó "${doc.nombre}"`;
  await registrarEventoContratacion(doc.expedienteId, "DOCUMENTO_VALIDADO", detalle, usuarioId);
  await registrarAuditoriaDoc({
    entidad: "DocumentoContrato",
    entidadId: documentoId,
    accion: "VALIDA",
    usuarioId,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    detalle,
  });
}

export class FaltanRequisitosError extends Error {
  constructor(public readonly faltantes: string[]) {
    super(`Faltan ${faltantes.length} documento(s) obligatorio(s) de esta etapa: ${faltantes.join("; ")}`);
    this.name = "FaltanRequisitosError";
  }
}

export async function aprobarEtapaContratacion(expedienteId: string, usuarioId: string, comentario?: string | null) {
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

  const documentosEtapa = await db.documentoContrato.findMany({
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
      firmas: { select: { fechaHora: true, formato: true } },
      solicitudesFirma: { select: { id: true, rol: true, orden: true, estado: true, usuarioAsignadoId: true, usuarioAsignado: { select: { nombre: true } } } },
    },
  });
  {
    const requisitos = await obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, expediente.etapaActual);
    const faltantes = requisitosObligatoriosFaltantes(cruzarChecklist(requisitos, documentosEtapa));
    if (faltantes.length > 0) throw new FaltanRequisitosError(faltantes);
  }

  const idsParaAprobar = documentosEtapa
    .filter((d) => d.estadoValidacion === "PENDIENTE" && !d.solicitudesFirma.some((s) => s.rol === "FIRMA" && s.estado === "PENDIENTE"))
    .map((d) => d.id);
  if (idsParaAprobar.length > 0) {
    await db.documentoContrato.updateMany({
      where: { id: { in: idsParaAprobar } },
      data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
    });
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

export async function desvincularContratistaDeUsuario(usuarioId: string) {
  await db.contratista.updateMany({ where: { usuarioId }, data: { usuarioId: null } });
}

export async function vincularUsuarioDominioAContratista(contratistaId: string, usuarioRedCrudo: string, actorId: string) {
  const usuarioRed = usuarioRedCrudo.trim().toLowerCase();
  if (!usuarioRed) throw new Error("Escriba el usuario de red.");
  if (/\s/.test(usuarioRed)) throw new Error("El usuario de red no debe contener espacios.");

  const contratista = await db.contratista.findUnique({ where: { id: contratistaId }, select: { id: true, usuarioId: true, nombreORazonSocial: true } });
  if (!contratista) throw new Error("El contratista no existe.");

  const existente = await db.usuario.findUnique({ where: { email: usuarioRed }, select: { id: true, nombre: true, rol: true, rolContratacion: true, contratista: { select: { id: true } } } });

  if (existente) {
    if (existente.contratista && existente.contratista.id === contratistaId) return existente;
    if (existente.contratista) throw new Error("Ese usuario de red ya está vinculado a otro contratista.");
    if (existente.rol === "ADMIN" || (existente.rolContratacion && existente.rolContratacion !== "CONTRATISTA")) {
      throw new Error(`"${usuarioRed}" ya es una cuenta con otro rol en el sistema (${existente.nombre}) — revise que el usuario de red sea el correcto.`);
    }
    await db.$transaction([
      db.usuario.update({ where: { id: existente.id }, data: { rolContratacion: "CONTRATISTA" } }),
      db.contratista.update({ where: { id: contratistaId }, data: { usuarioId: existente.id } }),
    ]);
    await registrarAuditoria({
      tipo: "USUARIO_ACTUALIZADO",
      descripcion: `${existente.nombre} (${usuarioRed}) se vinculó como usuario de dominio de ${contratista.nombreORazonSocial}.`,
      usuarioId: actorId,
    });
    return existente;
  }

  const creado = await db.usuario.create({
    data: {
      email: usuarioRed,
      nombre: nombreInicialDesdeUsuarioRed(usuarioRed),
      passwordHash: "directorio-activo:sin-contrasena-local",
      rol: "FUNCIONARIO",
      directorioActivo: true,
      rolContratacion: "CONTRATISTA",
    },
  });
  await db.contratista.update({ where: { id: contratistaId }, data: { usuarioId: creado.id } });
  await registrarAuditoria({
    tipo: "USUARIO_CREADO",
    descripcion: `Cuenta de directorio activo "${usuarioRed}" pre-creada y vinculada como usuario de dominio de ${contratista.nombreORazonSocial} (todavía no ha iniciado sesión).`,
    usuarioId: actorId,
  });
  return creado;
}

export async function desvincularUsuarioDominioDeContratista(contratistaId: string) {
  await db.contratista.update({ where: { id: contratistaId }, data: { usuarioId: null } });
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

function restringirPorRolContratacion(permisos: PermisosUsuario): Prisma.ExpedienteContractualWhereInput {
  if (
    permisos.esAdmin ||
    permisos.contratacion === "ADMINISTRADOR_CONTRATACION" ||
    permisos.contratacion === "JEFE_CONTRATACION" ||
    permisos.contratacion === "FUNCIONARIO_CONTRATACION"
  ) {
    return {};
  }
  if (permisos.contratacion === "JEFE_DEPENDENCIA") {
    return { dependenciaSolicitanteId: permisos.dependenciaId ?? "__sin_dependencia__" };
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
        { numeroContrato: { contains: q, mode: "insensitive" } },
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

function promedioDias(pares: { desde: Date; hasta: Date }[]): number {
  if (pares.length === 0) return 0;
  const total = pares.reduce((acc, p) => acc + (p.hasta.getTime() - p.desde.getTime()) / 86_400_000, 0);
  return Math.round(total / pares.length);
}

export async function obtenerPanelContratacionVista(permisos: PermisosUsuario) {
  const where = construirWhereExpedienteContractual({}, permisos);

  const [etapasCompletadas, solicitudesFirma, expedientes] = await Promise.all([
    db.etapaExpedienteContractual.findMany({
      where: { completadaEn: { not: null }, expediente: where },
      select: { etapa: true, abiertaEn: true, completadaEn: true },
    }),
    db.solicitudFirma.findMany({
      where: { documentoContratoId: { not: null }, rol: "FIRMA", documentoContrato: { expediente: where } },
      select: { estado: true, asignadoEn: true, completadoEn: true },
    }),
    db.expedienteContractual.findMany({
      where,
      select: { modalidadSeleccion: true, dependenciaSolicitante: { select: { nombre: true } } },
    }),
  ]);

  const tiempoPorEtapa = ETAPAS_ORDEN.map((etapa) => {
    const pares = etapasCompletadas
      .filter((e) => e.etapa === etapa)
      .map((e) => ({ desde: e.abiertaEn, hasta: e.completadaEn! }));
    return { label: ETIQUETA_ETAPA[etapa], value: promedioDias(pares) };
  });

  const conteoFirmas = { PENDIENTE: 0, COMPLETADA: 0, RECHAZADA: 0 } as Record<EstadoSolicitudFirma, number>;
  for (const s of solicitudesFirma) conteoFirmas[s.estado]++;
  const firmas = [
    { label: "Pendientes", value: conteoFirmas.PENDIENTE },
    { label: "Completadas", value: conteoFirmas.COMPLETADA },
    { label: "Rechazadas", value: conteoFirmas.RECHAZADA },
  ];
  const tiempoResolucionFirmas = promedioDias(
    solicitudesFirma
      .filter((s) => s.estado === "COMPLETADA" && s.completadoEn)
      .map((s) => ({ desde: s.asignadoEn, hasta: s.completadoEn! }))
  );

  const porDependenciaMap = new Map<string, number>();
  const porModalidadMap = new Map<ModalidadSeleccion, number>();
  for (const e of expedientes) {
    const nombreDep = e.dependenciaSolicitante.nombre;
    porDependenciaMap.set(nombreDep, (porDependenciaMap.get(nombreDep) ?? 0) + 1);
    porModalidadMap.set(e.modalidadSeleccion, (porModalidadMap.get(e.modalidadSeleccion) ?? 0) + 1);
  }
  const porDependencia = [...porDependenciaMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const porModalidad = [...porModalidadMap.entries()]
    .map(([modalidad, value]) => ({ label: ETIQUETA_MODALIDAD[modalidad], value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalExpedientes: expedientes.length,
    tiempoPorEtapa,
    firmas,
    tiempoResolucionFirmas,
    totalFirmasCompletadas: conteoFirmas.COMPLETADA,
    porDependencia,
    porModalidad,
  };
}

export async function listarAvisosRechazoParaUsuario(usuarioId: string, veTodos: boolean) {
  const avisos = await db.avisoRechazoDocumento.findMany({
    where: { documentoContratoId: { not: null }, ...(veTodos ? {} : { subidoPorId: usuarioId }) },
    orderBy: { createdAt: "desc" },
    include: {
      documentoContrato: { select: { id: true, nombre: true, mimeType: true, firmas: { select: { id: true } }, expedienteId: true, expediente: { select: { numero: true } } } },
      rechazadoPor: { select: { nombre: true } },
      subidoPor: { select: { nombre: true } },
    },
  });
  return avisos as (typeof avisos[number] & { documentoContrato: NonNullable<(typeof avisos)[number]["documentoContrato"]> })[];
}
