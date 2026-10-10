import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { parsePorPagina } from "@/lib/vista-lista";
import { calcularPeriodosInforme, esRequisitoPorPeriodos, nombreDocumentoPeriodo } from "@/lib/periodos-informe";
import { camposFaltantes, nombreCompletoPersona, nulo, regimenONulo, REQUERIDOS_CONTRATISTA } from "@/lib/datos-persona";
import { personaDesdeUsuario, SELECT_PERSONA_USUARIO } from "@/lib/usuarios-persona";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import type { PermisosUsuario } from "@/lib/permisos";
import type { EtapaContratacion, ModalidadSeleccion, RolFirmante, EstadoSolicitudFirma, CalidadFirma, Prisma } from "@prisma/client";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ETIQUETA_ROL_CONTRATACION, etapaHabilitada, mensajeEtapaNoHabilitada } from "@/lib/contratacion-etiquetas";
import { subserieDeModalidad } from "@/lib/trd-clasificacion";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import {
  MENSAJE_EXPEDIENTE_CERRADO,
  firmasPendientesContrato,
  mensajeFirmasPendientes,
  sincronizarArchivoContrato,
  validarFundamentoNivelAcceso,
} from "@/lib/archivo-central";

export * from "@/lib/contratacion-etiquetas";

export const TAG_CATALOGO_REQUISITOS = "catalogo-requisitos";

const SERIE_CONTRATO = "CTO";

export async function generarNumeroExpedienteContractual(anio: number = new Date().getFullYear()): Promise<string> {
  const { numero } = await generarConsecutivo(SERIE_CONTRATO, anio);
  return formatearRadicado(SERIE_CONTRATO, anio, numero);
}

export function vigenciaDeExpediente(fechaInicio: Date | null | undefined, createdAt: Date): number {
  return (fechaInicio ?? createdAt).getFullYear();
}

export function validarOrdenFechasContrato(fechaSuscripcion: Date | null, fechaInicio: Date | null): void {
  if (fechaSuscripcion && fechaInicio && fechaSuscripcion > fechaInicio) {
    throw new Error("La fecha de suscripción no puede ser posterior a la fecha de inicio (acta de inicio).");
  }
}

const FORMATO_SECOP = /^[A-Za-z0-9.\-/]{3,40}$/;

export function validarFormatoSecop(numeroProcesoSecop: string): void {
  if (!FORMATO_SECOP.test(numeroProcesoSecop)) {
    throw new Error(
      'El número de proceso SECOP no tiene un formato válido (entre 3 y 40 caracteres: letras, números, puntos, guiones o "/").'
    );
  }
}

export async function verificarUnicidadSecopPorVigencia(numeroProcesoSecop: string, vigencia: number, excluirId?: string): Promise<void> {
  const candidatos = await db.expedienteContractual.findMany({
    where: {
      eliminado: false,
      numeroProcesoSecop: { equals: numeroProcesoSecop, mode: "insensitive" },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { numero: true, fechaInicio: true, createdAt: true },
  });
  const conflicto = candidatos.find((c) => vigenciaDeExpediente(c.fechaInicio, c.createdAt) === vigencia);
  if (conflicto) {
    throw new Error(
      `El número de proceso SECOP "${numeroProcesoSecop}" ya está usado por el expediente ${conflicto.numero} en la vigencia ${vigencia}.`
    );
  }
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
        verificacionRecepcionEn: Date | null;
        verificacionRecepcionPorNombre: string | null;
        verificacionRecepcionObservaciones: string | null;
        cargadoEnSecop: boolean;
        cargadoEnSecopEn: Date | null;
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
          completadoEn: Date | null;
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
    verificacionRecepcionEn: Date | null;
    verificacionRecepcionPor: { nombre: string } | null;
    verificacionRecepcionObservaciones: string | null;
    cargadoEnSecop: boolean;
    cargadoEnSecopEn: Date | null;
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
      completadoEn: Date | null;
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
            verificacionRecepcionEn: ultimo.verificacionRecepcionEn,
            verificacionRecepcionPorNombre: ultimo.verificacionRecepcionPor?.nombre ?? null,
            verificacionRecepcionObservaciones: ultimo.verificacionRecepcionObservaciones,
            cargadoEnSecop: ultimo.cargadoEnSecop,
            cargadoEnSecopEn: ultimo.cargadoEnSecopEn,
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
              completadoEn: s.completadoEn,
            })),
          }
        : null,
    };
  });
}

export function requisitosObligatoriosFaltantes(checklist: ItemChecklist[]): string[] {
  // No basta con que exista un documento para el requisito: si el último que se subió está
  // pendiente o fue rechazado (p. ej. se eliminó uno ya aprobado y se volvió a subir sin
  // validar), el requisito sigue sin cumplirse.
  return checklist
    .filter((c) => c.obligatorio && (!c.documento || c.documento.estadoValidacion !== "APROBADO"))
    .map((c) => c.nombre);
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
  numeroProcesoSecop?: string | null;
  fechaSuscripcion?: Date | null;
  fechaInicio?: Date | null;
  fechaFinEstimada?: Date | null;
  dependenciaSolicitanteId: string;
  contratistaId?: string | null;
  supervisorUsuarioIds?: string[];
  personalAsignadoIds?: string[];
  subserieId?: string | null;
  creadoPorId: string;
}) {
  if (!datos.objeto.trim()) throw new Error("El objeto del contrato es obligatorio.");
  const automatica = datos.subserieId ? null : await subserieDeModalidad(datos.modalidadSeleccion);
  const subserieElegida = datos.subserieId ?? automatica?.subserieId ?? null;
  const subserie = subserieElegida ? await validarSubserieContrato(subserieElegida) : null;
  if (!datos.dependenciaSolicitanteId) throw new Error("Debe indicarse la dependencia solicitante.");
  validarOrdenFechasContrato(datos.fechaSuscripcion ?? null, datos.fechaInicio ?? null);

  const numeroProcesoSecop = datos.numeroProcesoSecop?.trim() || null;
  if (numeroProcesoSecop) {
    validarFormatoSecop(numeroProcesoSecop);
    await verificarUnicidadSecopPorVigencia(numeroProcesoSecop, vigenciaDeExpediente(datos.fechaInicio ?? null, new Date()));
  }

  const numero = await generarNumeroExpedienteContractual();
  const expediente = await db.expedienteContractual.create({
    data: {
      numero,
      objeto: datos.objeto.trim(),
      modalidadSeleccion: datos.modalidadSeleccion,
      valor: datos.valor ?? null,
      numeroContrato: datos.numeroContrato?.trim() || null,
      numeroProcesoSecop,
      fechaSuscripcion: datos.fechaSuscripcion ?? null,
      fechaInicio: datos.fechaInicio ?? null,
      fechaFinEstimada: datos.fechaFinEstimada ?? null,
      dependenciaSolicitanteId: datos.dependenciaSolicitanteId,
      subserieId: subserie?.id ?? null,
      contratistaId: datos.contratistaId || null,
      creadoPorId: datos.creadoPorId,
      etapas: { create: { etapa: "PRECONTRACTUAL" } },
      supervisores: datos.supervisorUsuarioIds?.length
        ? { create: datos.supervisorUsuarioIds.map((usuarioId) => ({ usuarioId })) }
        : undefined,
      asignados: datos.personalAsignadoIds?.length
        ? { create: datos.personalAsignadoIds.map((usuarioId) => ({ usuarioId, asignadoPorId: datos.creadoPorId })) }
        : undefined,
    },
  });

  await registrarEventoContratacion(
    expediente.id,
    "CREACION",
    `Expediente contractual creado: ${expediente.numero}${subserie ? ` · TRD ${subserie.etiqueta}${automatica ? ` (${automatica.motivo})` : ""}` : " · sin clasificación TRD"}`,
    datos.creadoPorId
  );
  return expediente;
}

async function validarSubserieContrato(subserieId: string) {
  const s = await db.subserieDocumental.findUnique({
    where: { id: subserieId },
    select: { id: true, codigo: true, nombre: true, activo: true, serie: { select: { activo: true, vigenteHasta: true } } },
  });
  if (!s || !s.activo || !s.serie.activo || s.serie.vigenteHasta) throw new Error("La subserie TRD elegida no existe o no está vigente.");
  return { id: s.id, etiqueta: `${s.codigo} — ${s.nombre}` };
}

export async function reclasificarTrdContrato(expedienteId: string, subserieId: string, motivo: string, usuarioId: string) {
  if (!motivo.trim()) throw new Error("Indique el motivo de la reclasificación.");
  const actual = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { eliminado: true, cerrado: true, subserie: { select: { codigo: true, nombre: true } } },
  });
  if (!actual || actual.eliminado) throw new Error("El expediente no existe.");
  if (actual.cerrado) throw new Error(MENSAJE_EXPEDIENTE_CERRADO);
  const nueva = await validarSubserieContrato(subserieId);
  await db.expedienteContractual.update({ where: { id: expedienteId }, data: { subserieId: nueva.id } });
  const anterior = actual.subserie ? `${actual.subserie.codigo} — ${actual.subserie.nombre}` : "sin clasificación";
  await registrarEventoContratacion(expedienteId, "RECLASIFICACION_TRD", `TRD: ${anterior} → ${nueva.etiqueta}. Motivo: ${motivo.trim()}`, usuarioId);
  await sincronizarArchivoContrato(expedienteId);
  return nueva;
}

export async function cambiarNivelAccesoContrato(
  expedienteId: string,
  nivelAcceso: "PUBLICA" | "CLASIFICADA" | "RESERVADA",
  fundamento: string,
  usuarioId: string
) {
  validarFundamentoNivelAcceso(nivelAcceso, fundamento);
  const actual = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { eliminado: true, cerrado: true, nivelAcceso: true },
  });
  if (!actual || actual.eliminado) throw new Error("El expediente no existe.");
  if (actual.cerrado) throw new Error(MENSAJE_EXPEDIENTE_CERRADO);
  await db.expedienteContractual.update({
    where: { id: expedienteId },
    data: { nivelAcceso, fundamentoNivelAcceso: nivelAcceso === "PUBLICA" ? null : fundamento.trim() },
  });
  await registrarEventoContratacion(
    expedienteId,
    "NIVEL_ACCESO_CAMBIADO",
    `Nivel de acceso: ${ETIQUETA_NIVEL_ACCESO[actual.nivelAcceso]} → ${ETIQUETA_NIVEL_ACCESO[nivelAcceso]}${
      nivelAcceso === "PUBLICA" ? "" : `. Fundamento: ${fundamento.trim()}`
    }`,
    usuarioId
  );
  await sincronizarArchivoContrato(expedienteId);
}

export async function reabrirExpedienteContractual(expedienteId: string, motivo: string, usuarioId: string) {
  if (!motivo.trim()) throw new Error("Reabrir un expediente cerrado exige indicar el motivo.");
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { eliminado: true, cerrado: true, etapaActual: true },
  });
  if (!expediente || expediente.eliminado) throw new Error("El expediente no existe.");
  if (!expediente.cerrado) throw new Error("Este expediente no está cerrado.");
  await db.expedienteContractual.update({ where: { id: expedienteId }, data: { cerrado: false, fechaCierre: null } });
  await db.etapaExpedienteContractual.updateMany({
    where: { expedienteId, etapa: expediente.etapaActual },
    data: { completadaEn: null, aprobadaPorId: null },
  });
  await registrarEventoContratacion(expedienteId, "EXPEDIENTE_REABIERTO", `Expediente reabierto. Motivo: ${motivo.trim()}`, usuarioId);
  await sincronizarArchivoContrato(expedienteId);
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
  periodoMes?: string | null;
  periodoEventualId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  cualquierEtapa?: boolean;
}) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: datos.expedienteId },
    select: { cerrado: true, modalidadSeleccion: true, fechaInicio: true, fechaFinEstimada: true, etapaActual: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");
  if (!datos.cualquierEtapa && !etapaHabilitada(expediente.etapaActual, datos.etapa)) throw new Error(mensajeEtapaNoHabilitada(datos.etapa));
  const posicion = ETAPAS_ORDEN.indexOf(datos.etapa) - ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const notaEtapa =
    posicion === 0 || datos.cualquierEtapa
      ? ""
      : ` — etapa ${posicion > 0 ? "posterior" : "anterior"} a la actual (${ETIQUETA_ETAPA[expediente.etapaActual]})`;

  let nombre = datos.nombre.trim();
  let categoria = datos.categoria?.trim() || null;
  let tipoDocumentalId: string | null = null;
  if (datos.requisitoId) {
    const requisito = await db.requisitoDocumentoContratacion.findUnique({ where: { id: datos.requisitoId } });
    if (!requisito || requisito.etapa !== datos.etapa || (requisito.modalidadSeleccion && requisito.modalidadSeleccion !== expediente.modalidadSeleccion)) {
      throw new Error("El requisito del catálogo indicado no corresponde a esta etapa/modalidad del expediente.");
    }
    nombre = requisito.nombre;
    categoria = null;
    tipoDocumentalId = requisito.tipoDocumentalId;

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
      tipoDocumentalId,
      nombre,
      storagePath: datos.storagePath,
      mimeType: datos.mimeType,
      tamanoBytes: datos.tamanoBytes,
      hashSha256: datos.hashSha256 || null,
      subidoPorId: datos.subidoPorId,
      requiereFirma: Boolean(datos.requiereFirma),
      periodoMes: datos.periodoMes?.trim() || null,
      periodoEventualId: datos.periodoEventualId?.trim() || null,
    },
  });

  await registrarEventoContratacion(
    datos.expedienteId,
    "DOCUMENTO_SUBIDO",
    `Se subió "${nombre}" (${ETIQUETA_ETAPA[datos.etapa]})${notaEtapa}`,
    datos.subidoPorId
  );
  await registrarAuditoriaDoc({
    entidad: "DocumentoContrato",
    entidadId: documento.id,
    accion: "CREA",
    usuarioId: datos.subidoPorId,
    ip: datos.ip ?? null,
    userAgent: datos.userAgent ?? null,
    detalle: `Se subió "${nombre}" (${ETIQUETA_ETAPA[datos.etapa]}) al expediente${notaEtapa}`,
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

export async function verificarRecepcionDocumentoContrato(documentoId: string, usuarioId: string, observaciones: string | null): Promise<void> {
  const doc = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { expedienteId: true, etapa: true, nombre: true } });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.etapa !== "PRECONTRACTUAL") throw new Error("La verificación de recepción solo aplica a documentos de la etapa Precontractual.");
  const obs = observaciones?.trim() || null;
  await db.documentoContrato.update({
    where: { id: documentoId },
    data: { verificacionRecepcionEn: new Date(), verificacionRecepcionPorId: usuarioId, verificacionRecepcionObservaciones: obs },
  });
  await registrarEventoContratacion(
    doc.expedienteId,
    "VERIFICACION_RECEPCION",
    `Se verificó la recepción de "${doc.nombre}".${obs ? ` Observaciones: ${obs}` : ""}`,
    usuarioId
  );
}

export async function marcarCargadoEnSecop(documentoId: string, usuarioId: string, cargado: boolean): Promise<void> {
  const doc = await db.documentoContrato.findUnique({
    where: { id: documentoId },
    select: { expedienteId: true, etapa: true, nombre: true, verificacionRecepcionEn: true },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.etapa !== "PRECONTRACTUAL") throw new Error('El estado "cargado en SECOP" solo aplica a documentos de la etapa Precontractual.');
  if (cargado && !doc.verificacionRecepcionEn) {
    throw new Error("Debe completar la verificación de recepción antes de marcarlo como cargado en SECOP.");
  }
  await db.documentoContrato.update({
    where: { id: documentoId },
    data: { cargadoEnSecop: cargado, cargadoEnSecopEn: cargado ? new Date() : null },
  });
  await registrarEventoContratacion(
    doc.expedienteId,
    "CARGADO_EN_SECOP",
    cargado ? `Se marcó "${doc.nombre}" como cargado en SECOP.` : `Se desmarcó "${doc.nombre}" como cargado en SECOP.`,
    usuarioId
  );
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
  if (doc.estadoValidacion === "RECHAZADO") {
    throw new Error(
      "El firmante rechazó este documento: no se puede aprobar directamente. Suba una versión corregida o pida al firmante que resuelva de nuevo la solicitud."
    );
  }

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
    super(`Faltan ${faltantes.length} documento(s) obligatorio(s) por subir y validar en esta etapa: ${faltantes.join("; ")}`);
    this.name = "FaltanRequisitosError";
  }
}

export async function aprobarEtapaContratacion(expedienteId: string, usuarioId: string, comentario?: string | null) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { etapaActual: true, cerrado: true, modalidadSeleccion: true, contratistaId: true, subserieId: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente ya está cerrado.");

  if (expediente.etapaActual === "PRECONTRACTUAL" && !expediente.contratistaId) {
    throw new Error(
      "No se puede pasar a la etapa Contractual sin conocer al contratista (persona natural o jurídica). Vincúlelo primero desde el expediente."
    );
  }
  if (ETAPAS_ORDEN.indexOf(expediente.etapaActual) === ETAPAS_ORDEN.length - 1) {
    if (!expediente.subserieId) throw new Error("Asigne la clasificación TRD (pestaña Administración) antes de cerrar el expediente.");
    const pendientes = await firmasPendientesContrato(expedienteId);
    if (pendientes > 0) throw new Error(mensajeFirmasPendientes(pendientes));
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
      verificacionRecepcionEn: true,
      verificacionRecepcionPor: { select: { nombre: true } },
      verificacionRecepcionObservaciones: true,
      cargadoEnSecop: true,
      cargadoEnSecopEn: true,
      createdAt: true,
      subidoPor: { select: { nombre: true } },
      firmas: { select: { fechaHora: true, formato: true } },
      solicitudesFirma: {
        select: { id: true, rol: true, orden: true, estado: true, usuarioAsignadoId: true, completadoEn: true, usuarioAsignado: { select: { nombre: true } } },
      },
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
    const evento = await db.eventoContratacion.create({
      data: {
        expedienteId,
        tipo: "EXPEDIENTE_CERRADO",
        detalle: "Se cerró el expediente contractual (fin de Postcontractual) y quedó archivado en el SGDEA.",
        usuarioId,
      },
    });
    try {
      await sincronizarArchivoContrato(expedienteId);
    } catch (err) {
      await db.eventoContratacion.delete({ where: { id: evento.id } });
      await db.expedienteContractual.update({ where: { id: expedienteId }, data: { cerrado: false, fechaCierre: null } });
      await db.etapaExpedienteContractual.updateMany({
        where: { expedienteId, etapa: expediente.etapaActual },
        data: { completadaEn: null, aprobadaPorId: null },
      });
      throw err;
    }
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
  if (expediente.cerrado) throw new Error(MENSAJE_EXPEDIENTE_CERRADO);

  const idxEfectivo = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  if (idxEfectivo === 0) throw new Error("El expediente ya está en la primera etapa (Precontractual).");

  const anterior = ETAPAS_ORDEN[idxEfectivo - 1]!;
  await db.expedienteContractual.update({
    where: { id: expedienteId },
    data: { etapaActual: anterior },
  });
  await db.etapaExpedienteContractual.upsert({
    where: { expedienteId_etapa: { expedienteId, etapa: anterior } },
    update: { completadaEn: null, aprobadaPorId: null },
    create: { expedienteId, etapa: anterior },
  });
  await registrarEventoContratacion(
    expedienteId,
    "ETAPA_RETROCEDIDA",
    `Se retrocedió de ${ETIQUETA_ETAPA[expediente.etapaActual]} a ${ETIQUETA_ETAPA[anterior]}: ${motivo.trim()}`,
    usuarioId
  );
}

export async function eliminarExpedienteContractualCompleto(expedienteId: string, usuarioId: string, motivo: string): Promise<void> {
  const expediente = await db.expedienteContractual.findUnique({ where: { id: expedienteId }, select: { eliminado: true, cerrado: true, numero: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.eliminado) throw new Error("Este expediente ya fue eliminado.");
  if (expediente.cerrado) throw new Error(MENSAJE_EXPEDIENTE_CERRADO);
  await db.expedienteContractual.update({
    where: { id: expedienteId },
    data: { eliminado: true, eliminadoEn: new Date(), eliminadoPorId: usuarioId, motivoEliminacion: motivo },
  });
  await registrarEventoContratacion(expedienteId, "EXPEDIENTE_ELIMINADO", `Se eliminó el expediente ${expediente.numero}. Motivo: ${motivo}`, usuarioId);
  await sincronizarArchivoContrato(expedienteId);
}

export const SELECT_USUARIO_CONTRATISTA = {
  id: true,
  activo: true,
  rol: true,
  email: true,
  rolesContratacion: true,
  ...SELECT_PERSONA_USUARIO,
} as const;

type UsuarioContratista = Prisma.UsuarioGetPayload<{ select: typeof SELECT_USUARIO_CONTRATISTA }>;

export function faltantesContratista(u: UsuarioContratista): string[] {
  return camposFaltantes(personaDesdeUsuario(u, false), REQUERIDOS_CONTRATISTA);
}

export function motivoNoPuedeSerContratista(u: Pick<UsuarioContratista, "activo" | "rol" | "rolesContratacion">): string | null {
  if (!u.activo) return "la cuenta está inactiva";
  if (u.rol === "ADMIN") return "es administrador de la plataforma";
  const otro = u.rolesContratacion.find((r) => r !== "CONTRATISTA");
  if (otro) return `tiene el rol ${ETIQUETA_ROL_CONTRATACION[otro] ?? otro} en GECON`;
  return null;
}

function datosContratistaDesdeUsuario(u: UsuarioContratista) {
  const p = personaDesdeUsuario(u, false);
  const esJuridica = p.tipoPersona === "JURIDICA";
  return {
    identificacion: p.identificacion.trim(),
    tipoPersona: p.tipoPersona,
    nombres: esJuridica ? null : nulo(p.nombres),
    apellidos: esJuridica ? null : nulo(p.apellidos),
    nombreORazonSocial: nombreCompletoPersona(p) || u.nombre,
    regimenTributario: regimenONulo(p.regimenTributario),
    granContribuyente: p.granContribuyente,
    contactoEmail: nulo(p.email),
    contactoCelular: nulo(p.celular),
    contactoTelefono: nulo(p.telefono),
    direccion: nulo(p.direccion),
    departamento: nulo(p.departamento),
    ciudad: nulo(p.ciudad),
  };
}

export async function asegurarContratistaDeUsuario(usuarioId: string): Promise<{ id: string; nombre: string }> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO_CONTRATISTA });
  if (!u) throw new Error("El usuario elegido no existe.");
  const motivo = motivoNoPuedeSerContratista(u);
  if (motivo) throw new Error(`${u.nombre} no puede ser contratista: ${motivo}.`);
  const faltan = faltantesContratista(u);
  if (faltan.length > 0) throw new Error(`Faltan datos de ${u.nombre} para iniciar el contrato: ${faltan.join(", ")}.`);

  const datos = datosContratistaDesdeUsuario(u);
  const [porUsuario, porIdentificacion] = await Promise.all([
    db.contratista.findUnique({ where: { usuarioId }, select: { id: true } }),
    db.contratista.findUnique({ where: { identificacion: datos.identificacion }, select: { id: true, usuarioId: true } }),
  ]);
  if (porIdentificacion && porIdentificacion.id !== porUsuario?.id && (porIdentificacion.usuarioId || porUsuario)) {
    throw new Error(`El documento ${datos.identificacion} ya corresponde a otro contratista registrado.`);
  }

  let id: string;
  if (porUsuario) {
    await db.contratista.update({ where: { id: porUsuario.id }, data: datos });
    id = porUsuario.id;
  } else if (porIdentificacion) {
    await db.contratista.update({ where: { id: porIdentificacion.id }, data: { ...datos, usuarioId } });
    id = porIdentificacion.id;
  } else {
    id = (await db.contratista.create({ data: { ...datos, usuarioId }, select: { id: true } })).id;
  }
  if (!u.rolesContratacion.includes("CONTRATISTA")) {
    await db.usuario.update({ where: { id: usuarioId }, data: { rolesContratacion: ["CONTRATISTA"] } });
  }
  return { id, nombre: datos.nombreORazonSocial };
}

export async function sincronizarContratistaDeUsuario(usuarioId: string): Promise<void> {
  const [contratista, u] = await Promise.all([
    db.contratista.findUnique({ where: { usuarioId }, select: { id: true } }),
    db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO_CONTRATISTA }),
  ]);
  if (!contratista || !u) return;
  const { identificacion, ...resto } = datosContratistaDesdeUsuario(u);
  const ocupada = identificacion
    ? await db.contratista.findFirst({ where: { identificacion, id: { not: contratista.id } }, select: { id: true } })
    : null;
  await db.contratista.update({
    where: { id: contratista.id },
    data: identificacion && !ocupada ? { ...resto, identificacion } : resto,
  });
}

export async function buscarUsuariosParaContrato(consulta: string, limite = 10) {
  const q = consulta.trim();
  if (q.length < 2) return [];
  const palabras = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const usuarios = await db.usuario.findMany({
    where: {
      activo: true,
      rol: { not: "ADMIN" },
      NOT: { rolesContratacion: { hasSome: ["ADMINISTRADOR_CONTRATACION", "JEFE_CONTRATACION", "FUNCIONARIO_CONTRATACION", "JEFE_DEPENDENCIA", "SUPERVISOR_INTERVENTOR"] } },
      AND: palabras.map((p) => ({
        OR: [
          { cedulaONit: { contains: p, mode: "insensitive" as const } },
          { nombres: { contains: p, mode: "insensitive" as const } },
          { apellidos: { contains: p, mode: "insensitive" as const } },
          { razonSocial: { contains: p, mode: "insensitive" as const } },
          { nombre: { contains: p, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { nombre: "asc" },
    take: limite,
    select: { ...SELECT_USUARIO_CONTRATISTA, dependencia: { select: { nombre: true } }, contratista: { select: { id: true } } },
  });
  return usuarios.map((u) => ({
    usuarioId: u.id,
    contratistaId: u.contratista?.id ?? null,
    nombre: u.nombre,
    tipoPersona: u.tipoPersona,
    identificacion: u.cedulaONit ?? "",
    ciudad: u.ciudad ?? "",
    dependencia: u.dependencia?.nombre ?? null,
    faltantes: faltantesContratista(u),
    persona: personaDesdeUsuario(u),
  }));
}

export type UsuarioParaContrato = Awaited<ReturnType<typeof buscarUsuariosParaContrato>>[number];

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
  const roles = permisos.rolesContratacion;
  if (permisos.esAdmin || roles.has("ADMINISTRADOR_CONTRATACION") || roles.has("JEFE_CONTRATACION")) return {};
  const caminos: Prisma.ExpedienteContractualWhereInput[] = [];
  if (roles.has("FUNCIONARIO_CONTRATACION")) caminos.push({ id: { in: Array.from(permisos.asignadoExpedientes) } });
  if (roles.has("JEFE_DEPENDENCIA")) caminos.push({ dependenciaSolicitanteId: permisos.dependenciaId ?? "__sin_dependencia__" });
  if (roles.has("SUPERVISOR_INTERVENTOR")) caminos.push({ id: { in: Array.from(permisos.supervisaExpedientes) } });
  if (roles.has("CONTRATISTA")) {
    caminos.push({ contratistaId: permisos.contratistaId ?? "__sin_contratista__", etapaActual: { not: "PRECONTRACTUAL" } });
  }
  if (caminos.length === 0) return { id: "__sin_acceso__" };
  return caminos.length === 1 ? caminos[0]! : { OR: caminos };
}

export function construirWhereExpedienteContractual(
  f: FiltrosContratacion,
  permisos: PermisosUsuario
): Prisma.ExpedienteContractualWhereInput {
  const and: Prisma.ExpedienteContractualWhereInput[] = [{ eliminado: false }, restringirPorRolContratacion(permisos)];
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
        { numeroProcesoSecop: { contains: q, mode: "insensitive" } },
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
