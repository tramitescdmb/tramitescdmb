import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { parsePorPagina } from "@/lib/vista-lista";
import { calcularPeriodosInforme, esRequisitoPorPeriodos, nombreDocumentoPeriodo } from "@/lib/periodos-informe";
import {
  camposFaltantes,
  leerDatosPersona,
  nombreCompletoPersona,
  nulo,
  regimenONulo,
  REQUERIDOS_CONTRATISTA,
  REQUERIDOS_CONTRATISTA_MINIMO_NATURAL,
  REQUERIDOS_CONTRATISTA_MINIMO_JURIDICA,
  TIPOS_IDENTIFICACION_USUARIO,
  type DatosPersona,
  separarNombreCompleto,
} from "@/lib/datos-persona";
import { dataUsuarioDesdePersona, personaDesdeUsuario, SELECT_PERSONA_USUARIO } from "@/lib/usuarios-persona";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import type { PermisosUsuario } from "@/lib/permisos";
import type { EtapaContratacion, ModalidadSeleccion, RolFirmante, EstadoSolicitudFirma, CalidadFirma, Prisma, TipoContratoEstatal, CausalContratacionDirecta } from "@prisma/client";
import { errorCombinacionContrato } from "@/lib/compatibilidad-modalidad";
import { errorCuantia, type TopeCuantia } from "@/lib/cuantias";
import { buscarContratosSecop, buscarContratosSecopPorContratista, consultarExpedienteSecop, contratoDesdeFila } from "@/lib/secop-datos";
import { CODIGO_ACTA_LIQUIDACION, requiereLiquidacion } from "@/lib/liquidacion";
import { errorCodigoProceso, formatearCodigoProceso, normalizarCodigoProceso, prefijoProceso } from "@/lib/codigo-proceso";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ETIQUETA_ROL_CONTRATACION, etapaHabilitada, mensajeEtapaNoHabilitada } from "@/lib/contratacion-etiquetas";
import { subserieDeModalidad } from "@/lib/trd-clasificacion";
import { fechaArchivoColombia } from "@/lib/fecha";
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
  async (modalidad: ModalidadSeleccion, etapa: EtapaContratacion, tipoContrato: TipoContratoEstatal = "PRESTACION_SERVICIOS", terminadoAnticipadamente = false) => {
    const requisitos = await db.requisitoDocumentoContratacion.findMany({
      where: {
        etapa,
        activo: true,
        OR: [{ modalidadSeleccion: null }, { modalidadSeleccion: modalidad }],
        aplicaTipoContrato: { in: tipoContrato === "OBRA" ? ["TODOS", "SOLO_OBRA"] : ["TODOS", "EXCEPTO_OBRA"] },
      },
      orderBy: [{ obligatorio: "desc" }, { orden: "asc" }],
    });
    if (requiereLiquidacion(tipoContrato, terminadoAnticipadamente)) return requisitos;
    return requisitos
      .map((r) => (r.codigoFormato?.includes(CODIGO_ACTA_LIQUIDACION) ? { ...r, obligatorio: false } : r))
      .sort((a, b) => Number(b.obligatorio) - Number(a.obligatorio) || a.orden - b.orden);
  },
  ["requisitos-de-etapa-v6"],
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
  return checklist
    .filter((c) => c.obligatorio)
    .flatMap((c) => {
      if (!c.documento) return [`${c.nombre}: sin subir`];
      if (c.documento.estadoValidacion === "RECHAZADO") return [`${c.nombre}: rechazado, requiere una versión corregida`];
      if (c.documento.solicitudesFirma.some((s) => s.rol === "FIRMA" && s.estado === "PENDIENTE")) return [`${c.nombre}: firma pendiente`];
      return [];
    });
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
    aplicaTipoContrato: "TODOS" | "SOLO_OBRA" | "EXCEPTO_OBRA";
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

export async function listarTopesCuantia(): Promise<TopeCuantia[]> {
  const filas = await db.topeCuantiaContratacion.findMany({ orderBy: { anio: "desc" } });
  return filas.map((f) => ({ anio: f.anio, menorCuantia: Number(f.menorCuantia), soporte: f.soporte }));
}

export async function topeCuantiaDe(anio: number): Promise<TopeCuantia | null> {
  const f = await db.topeCuantiaContratacion.findUnique({ where: { anio } });
  return f ? { anio: f.anio, menorCuantia: Number(f.menorCuantia), soporte: f.soporte } : null;
}

export async function guardarTopeCuantia(datos: { anio: number; menorCuantia: number; soporte: string | null }, usuarioId: string) {
  if (!Number.isInteger(datos.anio) || datos.anio < 2000 || datos.anio > 2100) throw new Error("Indique un año válido.");
  if (!Number.isFinite(datos.menorCuantia) || datos.menorCuantia <= 0) throw new Error("Indique el valor de la menor cuantía.");
  const data = { menorCuantia: Math.round(datos.menorCuantia), soporte: datos.soporte?.trim().slice(0, 300) || null, actualizadoPorId: usuarioId };
  await db.topeCuantiaContratacion.upsert({ where: { anio: datos.anio }, create: { anio: datos.anio, ...data }, update: data });
}

export async function validarCuantiaContrato(modalidad: string, valor: number | null, fechaSuscripcion: Date | null): Promise<void> {
  if (valor === null) return;
  const error = errorCuantia(modalidad, valor, await topeCuantiaDe((fechaSuscripcion ?? new Date()).getUTCFullYear()));
  if (error) throw new Error(error);
}

export async function resolverCodigoProceso(datos: {
  solicitado?: unknown;
  modalidad: string;
  causal: string | null;
  anio: number;
  actual?: string | null;
  excluirId?: string;
}): Promise<string> {
  const prefijo = prefijoProceso(datos.modalidad, datos.causal);
  if (!prefijo) throw new Error("Indique la causal de contratación directa para asignar el código de proceso.");
  const solicitado = normalizarCodigoProceso(datos.solicitado);
  if (solicitado) {
    const error = errorCodigoProceso(solicitado, datos.modalidad, datos.causal);
    if (error) throw new Error(error);
    const repetido = await db.expedienteContractual.findFirst({
      where: { codigoProceso: solicitado, ...(datos.excluirId ? { id: { not: datos.excluirId } } : {}) },
      select: { numero: true },
    });
    if (repetido) throw new Error(`El código de proceso ${solicitado} ya está asignado al expediente ${repetido.numero}.`);
    return solicitado;
  }
  if (datos.actual && datos.actual.startsWith(`${prefijo}-`)) return datos.actual;
  for (let intento = 0; intento < 50; intento++) {
    const { numero } = await generarConsecutivo(`PROC-${prefijo}`, datos.anio);
    const codigo = formatearCodigoProceso(prefijo, numero, datos.anio);
    if (!(await db.expedienteContractual.findUnique({ where: { codigoProceso: codigo }, select: { id: true } }))) return codigo;
  }
  throw new Error("No se pudo asignar el código de proceso.");
}

export const OBJETO_POR_DEFINIR = "Por definir: se toma de SECOP II al enlazar el contrato.";

export async function crearExpedienteContractual(datos: {
  objeto: string;
  modalidadSeleccion: ModalidadSeleccion;
  tipoContrato: TipoContratoEstatal;
  causalContratacionDirecta?: CausalContratacionDirecta | null;
  codigoProceso?: string | null;
  idContratoSecop?: string | null;
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
  const objeto = datos.objeto.trim() || OBJETO_POR_DEFINIR;
  const causal = datos.modalidadSeleccion === "CONTRATACION_DIRECTA" ? datos.causalContratacionDirecta ?? null : null;
  const combinacion = errorCombinacionContrato(datos.modalidadSeleccion, datos.tipoContrato, causal);
  if (combinacion) throw new Error(combinacion);
  await validarCuantiaContrato(datos.modalidadSeleccion, datos.valor ?? null, datos.fechaSuscripcion ?? null);
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

  const codigoProceso = await resolverCodigoProceso({
    solicitado: datos.codigoProceso,
    modalidad: datos.modalidadSeleccion,
    causal,
    anio: (datos.fechaSuscripcion ?? new Date()).getUTCFullYear(),
  });
  const numero = await generarNumeroExpedienteContractual();
  const expediente = await db.expedienteContractual.create({
    data: {
      numero,
      objeto,
      modalidadSeleccion: datos.modalidadSeleccion,
      tipoContrato: datos.tipoContrato,
      causalContratacionDirecta: causal,
      codigoProceso,
      idContratoSecop: datos.idContratoSecop ?? null,
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
    if (requisito.codigoFormato?.includes("A-BS-FO131")) {
      await db.expedienteContractual.update({ where: { id: datos.expedienteId }, data: { terminadoAnticipadamente: true } });
    }
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

export async function validarDocumentoContrato(
  documentoId: string,
  usuarioId: string,
  opts: { sinTraza: boolean; ip?: string | null; userAgent?: string | null }
): Promise<void> {
  const doc = await db.documentoContrato.findUnique({
    where: { id: documentoId },
    select: { nombre: true, expedienteId: true, estadoValidacion: true, etapa: true, verificacionRecepcionEn: true },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.etapa !== "PRECONTRACTUAL") throw new Error("Solo se validan documentos de la etapa Precontractual.");
  if (doc.estadoValidacion === "APROBADO") throw new Error("Este documento ya está validado.");
  if (doc.estadoValidacion === "RECHAZADO") {
    throw new Error(
      "El firmante rechazó este documento: no se puede aprobar directamente. Suba una versión corregida o pida al firmante que resuelva de nuevo la solicitud."
    );
  }

  const ahora = new Date();
  await db.documentoContrato.update({
    where: { id: documentoId },
    data: {
      estadoValidacion: "APROBADO",
      validadoPorId: usuarioId,
      validadoEn: ahora,
      ...(!doc.verificacionRecepcionEn ? { verificacionRecepcionEn: ahora, verificacionRecepcionPorId: usuarioId } : {}),
    },
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
    super(`Hay ${faltantes.length} documento(s) obligatorio(s) pendiente(s) en esta etapa: ${faltantes.join("; ")}`);
    this.name = "FaltanRequisitosError";
  }
}

export async function aprobarEtapaContratacion(expedienteId: string, usuarioId: string, comentario?: string | null) {
  const expediente = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: { etapaActual: true, cerrado: true, modalidadSeleccion: true, tipoContrato: true, terminadoAnticipadamente: true, contratistaId: true, subserieId: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.cerrado) throw new Error("Este expediente ya está cerrado.");

  if (expediente.etapaActual === "PRECONTRACTUAL") {
    if (!expediente.contratistaId) {
      throw new Error(
        "No se puede pasar a la etapa Contractual sin conocer al contratista (persona natural o jurídica). Vincúlelo primero desde el expediente."
      );
    }
    if (!(await intentarVincularContratistaConUsuario(expediente.contratistaId))) {
      throw new Error(
        "El contratista todavía no corresponde a un usuario completo del sistema (debe crearlo o completar sus datos en Usuarios, con el mismo número de documento). Inténtelo de nuevo una vez exista — no hace falta repetir ningún otro paso."
      );
    }
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
    const requisitos = await obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, expediente.etapaActual, expediente.tipoContrato, expediente.terminadoAnticipadamente);
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

async function pasarAContractualPorSecop(expedienteId: string, fechaFirma: string) {
  const ahora = new Date();
  const comentario = `Paso automático: SECOP II reporta el contrato firmado el ${fechaFirma}.`;
  await db.$transaction([
    db.etapaExpedienteContractual.upsert({
      where: { expedienteId_etapa: { expedienteId, etapa: "PRECONTRACTUAL" } },
      update: { completadaEn: ahora, comentario },
      create: { expedienteId, etapa: "PRECONTRACTUAL", completadaEn: ahora, comentario },
    }),
    db.expedienteContractual.update({ where: { id: expedienteId }, data: { etapaActual: "CONTRACTUAL" } }),
    db.etapaExpedienteContractual.upsert({
      where: { expedienteId_etapa: { expedienteId, etapa: "CONTRACTUAL" } },
      update: {},
      create: { expedienteId, etapa: "CONTRACTUAL" },
    }),
  ]);
  await registrarEventoContratacion(expedienteId, "ETAPA_APROBADA", `Pasó de Precontractual a Contractual. ${comentario}`, null);
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
    await db.usuario.update({ where: { id: usuarioId }, data: { rolesContratacion: ["CONTRATISTA"], modulosAcceso: { push: "GECON" } } });
  }
  return { id, nombre: datos.nombreORazonSocial };
}

export async function sincronizarContratistaDeUsuario(usuarioId: string): Promise<void> {
  const [contratista, u] = await Promise.all([
    db.contratista.findUnique({ where: { usuarioId }, select: { id: true } }),
    db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO_CONTRATISTA }),
  ]);
  if (!u) return;
  if (!contratista) {
    if (!u.cedulaONit) return;
    const pendiente = await db.contratista.findFirst({ where: { usuarioId: null, identificacion: u.cedulaONit.trim() }, select: { id: true } });
    if (pendiente) await intentarVincularContratistaConUsuario(pendiente.id);
    return;
  }
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

export async function buscarPerfilesSinUsuario(consulta: string, limite = 5) {
  const palabras = consulta.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (consulta.trim().length < 2) return [];
  const perfiles = await db.contratista.findMany({
    where: {
      usuarioId: null,
      AND: palabras.map((p) => ({
        OR: [{ identificacion: { contains: p, mode: "insensitive" as const } }, { nombreORazonSocial: { contains: p, mode: "insensitive" as const } }],
      })),
    },
    take: limite,
    select: { id: true, nombreORazonSocial: true, identificacion: true, tipoPersona: true, usuarioRed: true },
  });
  return perfiles.map((p) => ({ contratistaId: p.id, nombre: p.nombreORazonSocial, identificacion: p.identificacion, tipoPersona: p.tipoPersona, usuarioRed: p.usuarioRed }));
}

// --- Contratista "perfil mínimo" en la etapa precontractual --------------------------------
//
// Antes de que exista un Usuario real para el futuro contratista (lo normal en precontractual:
// la persona natural o jurídica con la que se va a contratar puede no tener ninguna cuenta en el
// sistema todavía), se permite registrar un Contratista con solo los datos mínimos, sin crear un
// Usuario. Más adelante, al pasar a la etapa Contractual, se intenta enlazar ese Contratista con
// un Usuario real por documento/NIT (ver intentarVincularContratistaConUsuario) — si no se logra,
// el paso de etapa queda bloqueado pero es reintentable sin perder nada de lo ya diligenciado.

function textoRepresentante(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export type RepresentanteLegalDatos = {
  nombres: string;
  apellidos: string;
  identificacion: string;
  direccion: string;
  telefono: string;
  celular: string;
};

export function leerRepresentanteLegal(body: unknown): RepresentanteLegalDatos {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    nombres: textoRepresentante(b.nombres, 120),
    apellidos: textoRepresentante(b.apellidos, 120),
    identificacion: textoRepresentante(b.identificacion, 30),
    direccion: textoRepresentante(b.direccion, 200),
    telefono: textoRepresentante(b.telefono, 30),
    celular: textoRepresentante(b.celular, 30),
  };
}

export function faltantesRepresentanteLegal(r: RepresentanteLegalDatos): string[] {
  const falta: string[] = [];
  if (!r.identificacion) falta.push("cédula del representante legal");
  if (!r.nombres || !r.apellidos) falta.push("nombres y apellidos del representante legal");
  if (!r.direccion) falta.push("dirección del representante legal");
  if (!r.celular) falta.push("celular del representante legal");
  return falta;
}

export function faltantesContratistaMinimo(p: Partial<DatosPersona>): string[] {
  const requeridos = p.tipoPersona === "JURIDICA" ? REQUERIDOS_CONTRATISTA_MINIMO_JURIDICA : REQUERIDOS_CONTRATISTA_MINIMO_NATURAL;
  return camposFaltantes(p, requeridos);
}

export class ContratistaDuplicadoError extends Error {
  constructor(
    public readonly identificacion: string,
    public readonly contratistaId: string,
    nombre: string
  ) {
    super(`Ya existe un contratista registrado con el documento ${identificacion} (${nombre}).`);
    this.name = "ContratistaDuplicadoError";
  }
}

function datosContratistaDesdePersonaMinima(persona: DatosPersona) {
  return {
    identificacion: persona.identificacion.trim(),
    tipoPersona: persona.tipoPersona,
    nombres: persona.tipoPersona === "JURIDICA" ? null : nulo(persona.nombres),
    apellidos: persona.tipoPersona === "JURIDICA" ? null : nulo(persona.apellidos),
    nombreORazonSocial: nombreCompletoPersona(persona),
    contactoEmail: nulo(persona.email),
    contactoCelular: nulo(persona.celular),
    contactoTelefono: nulo(persona.telefono),
    direccion: nulo(persona.direccion),
    departamento: nulo(persona.departamento),
    ciudad: nulo(persona.ciudad),
  };
}

export async function crearContratistaMinimo(personaBody: unknown, representanteBody: unknown, usuarioRedBody?: unknown): Promise<{ id: string; nombre: string }> {
  const usuarioRed = normalizarUsuarioRed(usuarioRedBody);
  if (usuarioRed) {
    if (await db.usuario.findFirst({ where: { email: { equals: usuarioRed, mode: "insensitive" } }, select: { id: true } })) {
      throw new Error(`El usuario de red ${usuarioRed} ya existe en la plataforma: vincúlelo en lugar de registrarlo.`);
    }
    if (await db.contratista.findFirst({ where: { usuarioRed }, select: { id: true } })) {
      throw new Error(`El usuario de red ${usuarioRed} ya está asignado a otro contratista.`);
    }
  }
  const persona = leerDatosPersona(personaBody, TIPOS_IDENTIFICACION_USUARIO);
  const faltan = faltantesContratistaMinimo(persona);
  if (faltan.length > 0) throw new Error(`Faltan datos del contratista: ${faltan.join(", ")}.`);

  const representante = persona.tipoPersona === "JURIDICA" ? leerRepresentanteLegal(representanteBody) : null;
  if (representante) {
    const faltanRep = faltantesRepresentanteLegal(representante);
    if (faltanRep.length > 0) throw new Error(`Faltan datos del representante legal: ${faltanRep.join(", ")}.`);
  }

  const datos = datosContratistaDesdePersonaMinima(persona);
  const existente = await db.contratista.findUnique({ where: { identificacion: datos.identificacion }, select: { id: true, nombreORazonSocial: true } });
  if (existente) throw new ContratistaDuplicadoError(datos.identificacion, existente.id, existente.nombreORazonSocial);

  const creado = await db.contratista.create({
    data: {
      ...datos,
      usuarioRed: usuarioRed || null,
      ...(representante
        ? {
            representanteLegal: {
              create: {
                nombres: representante.nombres,
                apellidos: representante.apellidos,
                identificacion: representante.identificacion,
                direccion: nulo(representante.direccion),
                telefono: nulo(representante.telefono),
                celular: nulo(representante.celular),
              },
            },
          }
        : {}),
    },
    select: { id: true, nombreORazonSocial: true },
  });
  return { id: creado.id, nombre: creado.nombreORazonSocial };
}

export async function editarContratistaMinimo(contratistaId: string, personaBody: unknown, representanteBody: unknown): Promise<void> {
  const actual = await db.contratista.findUnique({
    where: { id: contratistaId },
    select: { usuarioId: true, representanteLegal: { select: { id: true } } },
  });
  if (!actual) throw new Error("El contratista no existe.");
  if (actual.usuarioId) {
    throw new Error("Este contratista ya está vinculado a un usuario del sistema: sus datos se editan desde Usuarios.");
  }

  const persona = leerDatosPersona(personaBody, TIPOS_IDENTIFICACION_USUARIO);
  const faltan = faltantesContratistaMinimo(persona);
  if (faltan.length > 0) throw new Error(`Faltan datos del contratista: ${faltan.join(", ")}.`);
  const datos = datosContratistaDesdePersonaMinima(persona);

  const ocupada = await db.contratista.findFirst({ where: { identificacion: datos.identificacion, id: { not: contratistaId } }, select: { id: true } });
  if (ocupada) throw new Error(`El documento ${datos.identificacion} ya corresponde a otro contratista registrado.`);

  let representante: RepresentanteLegalDatos | null = null;
  if (persona.tipoPersona === "JURIDICA") {
    representante = leerRepresentanteLegal(representanteBody);
    const faltanRep = faltantesRepresentanteLegal(representante);
    if (faltanRep.length > 0) throw new Error(`Faltan datos del representante legal: ${faltanRep.join(", ")}.`);
  }

  await db.contratista.update({
    where: { id: contratistaId },
    data: {
      ...datos,
      ...(representante
        ? {
            representanteLegal: {
              upsert: {
                create: {
                  nombres: representante.nombres,
                  apellidos: representante.apellidos,
                  identificacion: representante.identificacion,
                  direccion: nulo(representante.direccion),
                  telefono: nulo(representante.telefono),
                  celular: nulo(representante.celular),
                },
                update: {
                  nombres: representante.nombres,
                  apellidos: representante.apellidos,
                  identificacion: representante.identificacion,
                  direccion: nulo(representante.direccion),
                  telefono: nulo(representante.telefono),
                  celular: nulo(representante.celular),
                },
              },
            },
          }
        : actual.representanteLegal
          ? { representanteLegal: { delete: true } }
          : {}),
    },
  });
}

/**
 * Al pasar de etapa PRECONTRACTUAL a CONTRACTUAL, un Contratista "perfil mínimo" (sin Usuario
 * todavía) debe quedar vinculado a un Usuario real del sistema: solo así puede firmar documentos
 * del contrato y recibir el rol CONTRATISTA. Busca por documento/NIT; si ya está vinculado, solo
 * refresca sus datos desde el Usuario (por si cambiaron). Devuelve false — sin lanzar error, para
 * que el llamador decida el mensaje — cuando todavía no hay forma de vincularlo: el paso de etapa
 * queda bloqueado pero se puede reintentar sin perder nada ya diligenciado.
 */
export async function intentarVincularContratistaConUsuario(contratistaId: string): Promise<boolean> {
  const contratista = await db.contratista.findUnique({
    where: { id: contratistaId },
    select: { usuarioId: true, identificacion: true },
  });
  if (!contratista) return false;
  if (contratista.usuarioId) {
    await sincronizarContratistaDeUsuario(contratista.usuarioId);
    return true;
  }
  if (!contratista.identificacion.trim()) return false;

  const usuario = await db.usuario.findFirst({ where: { cedulaONit: contratista.identificacion }, select: SELECT_USUARIO_CONTRATISTA });
  if (!usuario || motivoNoPuedeSerContratista(usuario) || faltantesContratista(usuario).length > 0) return false;

  try {
    await db.contratista.update({ where: { id: contratistaId }, data: { ...datosContratistaDesdeUsuario(usuario), usuarioId: usuario.id } });
  } catch {
    return false;
  }
  if (!usuario.rolesContratacion.includes("CONTRATISTA")) {
    await db.usuario.update({ where: { id: usuario.id }, data: { rolesContratacion: ["CONTRATISTA"], modulosAcceso: { push: "GECON" } } });
  }
  return true;
}

export type FiltrosContratacion = {
  q?: string;
  etapa?: string;
  modalidad?: string;
  contratistaId?: string;
  dependenciaId?: string;
  vigencia?: string;
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
  if (f.etapa === "TERMINADOS") {
    const hoy = new Date(`${fechaArchivoColombia()}T00:00:00Z`);
    and.push({ OR: [{ cerrado: true }, { etapaActual: "POSTCONTRACTUAL" }, { fechaFinEstimada: { lt: hoy } }] });
  }
  if (f.modalidad) and.push({ modalidadSeleccion: f.modalidad as ModalidadSeleccion });
  if (f.dependenciaId) and.push({ dependenciaSolicitanteId: f.dependenciaId });
  if (f.vigencia && /^\d{4}$/.test(f.vigencia)) {
    const anio = Number(f.vigencia);
    const rango = { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
    and.push({ OR: [{ fechaSuscripcion: rango }, { fechaSuscripcion: null, createdAt: rango }] });
  }
  if (f.contratistaId) and.push({ contratistaId: f.contratistaId });
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { numero: { contains: q, mode: "insensitive" } },
        { codigoProceso: { contains: q, mode: "insensitive" } },
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
  const soloContractuales = !permisos.esAdmin && permisos.rolesContratacion.has("CONTRATISTA");

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
        supervisores: { select: { usuario: { select: { nombre: true } } } },
        _count: { select: { documentos: soloContractuales ? { where: { etapa: { not: "PRECONTRACTUAL" } } } : true } },
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

export function normalizarUsuarioRed(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase().replace(/^.*\\/, "").replace(/@.*$/, "").slice(0, 60) : "";
}

export async function consultarUsuarioRedContratista(valor: string) {
  const usuarioRed = normalizarUsuarioRed(valor);
  if (!usuarioRed) return null;
  const [usuario, pendiente] = await Promise.all([
    db.usuario.findFirst({
      where: { email: { equals: usuarioRed, mode: "insensitive" } },
      select: { ...SELECT_USUARIO_CONTRATISTA, directorioActivo: true, contratista: { select: { id: true } } },
    }),
    db.contratista.findFirst({ where: { usuarioRed, usuarioId: null }, select: { id: true, nombreORazonSocial: true } }),
  ]);
  if (!usuario) return { usuarioRed, existe: false as const, pendiente };
  return {
    usuarioRed,
    existe: true as const,
    usuarioId: usuario.id,
    nombre: usuario.nombre,
    documento: usuario.cedulaONit,
    directorioActivo: usuario.directorioActivo,
    contratistaId: usuario.contratista?.id ?? null,
    motivo: motivoNoPuedeSerContratista(usuario),
    faltan: faltantesContratista(usuario),
  };
}

export async function vincularContratistaPorUsuarioRed(usuarioId: string, valor: string): Promise<void> {
  const usuarioRed = normalizarUsuarioRed(valor);
  if (!usuarioRed) return;
  const pendiente = await db.contratista.findFirst({ where: { usuarioRed, usuarioId: null } });
  if (!pendiente) return;
  await vincularPerfilConUsuario(pendiente, usuarioId);
}

export async function vincularPerfilConUsuario(pendiente: Prisma.ContratistaGetPayload<object>, usuarioId: string): Promise<boolean> {
  const [usuario, yaVinculado] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: { ...SELECT_USUARIO_CONTRATISTA, modulosAcceso: true } }),
    db.contratista.findUnique({ where: { usuarioId }, select: { id: true } }),
  ]);
  if (!usuario || yaVinculado || motivoNoPuedeSerContratista(usuario)) return false;
  const actual = personaDesdeUsuario(usuario, false);
  if (actual.identificacion.trim() && actual.identificacion.trim() !== pendiente.identificacion) return false;

  const deContratista: Partial<DatosPersona> = {
    tipoPersona: pendiente.tipoPersona,
    tipoIdentificacion: pendiente.tipoPersona === "JURIDICA" ? "NIT" : "CC",
    identificacion: pendiente.identificacion,
    nombres: pendiente.nombres ?? "",
    apellidos: pendiente.apellidos ?? "",
    razonSocial: pendiente.tipoPersona === "JURIDICA" ? pendiente.nombreORazonSocial : "",
    email: pendiente.contactoEmail ?? "",
    celular: pendiente.contactoCelular ?? "",
    telefono: pendiente.contactoTelefono ?? "",
    direccion: pendiente.direccion ?? "",
    departamento: pendiente.departamento ?? "",
    ciudad: pendiente.ciudad ?? "",
  };
  const combinada = { ...actual };
  for (const [k, v] of Object.entries(deContratista) as [keyof DatosPersona, string][]) {
    if (typeof combinada[k] === "string" && !(combinada[k] as string).trim() && v) (combinada as Record<string, unknown>)[k] = v;
  }
  if (!actual.identificacion.trim()) {
    combinada.tipoPersona = pendiente.tipoPersona;
    combinada.tipoIdentificacion = deContratista.tipoIdentificacion!;
  }

  const modulos = [...new Set([...usuario.modulosAcceso, "GECON" as const])];
  await db.$transaction([
    db.usuario.update({
      where: { id: usuarioId },
      data: {
        ...dataUsuarioDesdePersona(combinada),
        rolesContratacion: ["CONTRATISTA"],
        modulosAcceso: modulos,
      },
    }),
    db.contratista.update({ where: { id: pendiente.id }, data: { usuarioId } }),
  ]);
  return true;
}





const ETIQUETA_CAMPO_SECOP: Record<string, string> = {
  numeroContrato: "número de contrato",
  numeroProcesoSecop: "número de proceso",
  valor: "valor",
  fechaSuscripcion: "fecha de firma",
  fechaInicio: "fecha de inicio",
  fechaFinEstimada: "fecha de terminación",
  objeto: "objeto",
  modalidadSeleccion: "modalidad",
  causalContratacionDirecta: "causal",
  tipoContrato: "tipo de contrato",
  codigoProceso: "código de proceso",
  contratistaId: "contratista",
};

function jsonEstable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonEstable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export async function sincronizarExpedienteSecop(expedienteId: string, usuarioId: string | null) {
  const expediente = await db.expedienteContractual.findUniqueOrThrow({
    where: { id: expedienteId },
    select: {
      idContratoSecop: true,
      numeroContrato: true,
      numeroProcesoSecop: true,
      valor: true,
      fechaSuscripcion: true,
      fechaInicio: true,
      fechaFinEstimada: true,
      createdAt: true,
      objeto: true,
      modalidadSeleccion: true,
      causalContratacionDirecta: true,
      tipoContrato: true,
      codigoProceso: true,
      contratistaId: true,
      etapaActual: true,
      cerrado: true,
      contratista: { select: { identificacion: true } },
      secop: { select: { datos: true, facturas: true, garantias: true, modificaciones: true, adiciones: true, suspensiones: true } },
    },
  });
  let idContrato = expediente.idContratoSecop;
  if (!idContrato) {
    const ref = expediente.numeroContrato ?? expediente.numeroProcesoSecop;
    let candidatos = ref ? await buscarContratosSecop(ref) : [];
    let criterio = ref ? `la referencia ${ref}` : "";
    if (candidatos.length === 0 && expediente.contratista?.identificacion) {
      const desde = new Date(expediente.createdAt.getTime() - 60 * 24 * 60 * 60 * 1000);
      const enlazados = new Set(
        (await db.expedienteContractual.findMany({ where: { idContratoSecop: { not: null }, id: { not: expedienteId } }, select: { idContratoSecop: true } })).map(
          (e) => e.idContratoSecop
        )
      );
      candidatos = (await buscarContratosSecopPorContratista(expediente.contratista.identificacion, desde, expediente.createdAt)).filter((c) => !enlazados.has(c.idContrato));
      criterio = `el documento del contratista ${expediente.contratista.identificacion}`;
    }
    if (!criterio) throw new Error("Aún no hay con qué buscarlo en SECOP II: vincule el contratista o escriba el número de contrato o de proceso.");
    if (candidatos.length === 0) throw new Error(`Aún no aparece en SECOP II un contrato de la CDMB con ${criterio}.`);
    if (candidatos.length > 1) {
      throw new Error(
        `Hay ${candidatos.length} contratos en SECOP II con ${criterio} (${candidatos.map((c) => c.numeroContrato).join(", ")}): escriba el número de contrato en los datos generales.`
      );
    }
    idContrato = candidatos[0]!.idContrato;
  }
  if (!idContrato) throw new Error("SECOP II no devolvió el identificador del contrato.");
  const secop = await consultarExpedienteSecop(idContrato);
  if (!secop) throw new Error(`El contrato ${idContrato} no aparece en SECOP II para la CDMB.`);
  const c = contratoDesdeFila(secop.datos);
  const fechaDb = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);


  const desdeSecop: Record<string, unknown> = {
    numeroContrato: c.numeroContrato,
    numeroProcesoSecop: c.numeroProcesoSecop,
    valor: c.valor,
    fechaSuscripcion: fechaDb(c.fechaSuscripcion),
    fechaInicio: fechaDb(c.fechaInicio),
    fechaFinEstimada: fechaDb(c.fechaFin),
    objeto: c.objeto,
    modalidadSeleccion: c.modalidad,
    causalContratacionDirecta: c.causal,
    tipoContrato: c.tipoContrato,
  };
  const actual: Record<string, unknown> = {
    numeroContrato: expediente.numeroContrato,
    numeroProcesoSecop: expediente.numeroProcesoSecop,
    valor: expediente.valor !== null ? Number(expediente.valor) : null,
    fechaSuscripcion: expediente.fechaSuscripcion,
    fechaInicio: expediente.fechaInicio,
    fechaFinEstimada: expediente.fechaFinEstimada,
    objeto: expediente.objeto,
    modalidadSeleccion: expediente.modalidadSeleccion,
    causalContratacionDirecta: expediente.causalContratacionDirecta,
    tipoContrato: expediente.tipoContrato,
  };
  const comparable = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null);
  const completar: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(desdeSecop)) {
    if (valor === null || valor === undefined || valor === "") continue;
    if (comparable(actual[campo]) !== comparable(valor)) completar[campo] = valor;
  }
  if ("modalidadSeleccion" in completar || "causalContratacionDirecta" in completar) {
    completar.codigoProceso = await resolverCodigoProceso({
      modalidad: String(completar.modalidadSeleccion ?? expediente.modalidadSeleccion),
      causal: (("causalContratacionDirecta" in completar ? completar.causalContratacionDirecta : expediente.causalContratacionDirecta) as string | null) ?? null,
      anio: (fechaDb(c.fechaSuscripcion) ?? expediente.createdAt).getUTCFullYear(),
      actual: expediente.codigoProceso,
      excluirId: expedienteId,
    });
    if (completar.codigoProceso === expediente.codigoProceso) delete completar.codigoProceso;
  }
  const documento = c.contratista.documento;
  if (documento && expediente.contratista?.identificacion !== documento) {
    const usuario = await db.usuario.findFirst({ where: { cedulaONit: documento, activo: true }, select: { id: true } });
    const contratistaId = usuario ? (await asegurarContratistaDeUsuario(usuario.id)).id : await asegurarPerfilDesdeSecop(c.contratista);
    if (contratistaId && contratistaId !== expediente.contratistaId) completar.contratistaId = contratistaId;
  }

  const espejo = {
    idContrato,
    datos: secop.datos as Prisma.InputJsonValue,
    facturas: secop.facturas as Prisma.InputJsonValue,
    garantias: secop.garantias as Prisma.InputJsonValue,
    modificaciones: secop.modificaciones as Prisma.InputJsonValue,
    adiciones: secop.adiciones as Prisma.InputJsonValue,
    suspensiones: secop.suspensiones as Prisma.InputJsonValue,
    sincronizadoEn: new Date(),
  };
  await db.$transaction([
    db.secopContratoEspejo.upsert({ where: { expedienteId }, create: { expedienteId, ...espejo }, update: espejo }),
    db.expedienteContractual.update({
      where: { id: expedienteId },
      data: {
        idContratoSecop: idContrato,
        supervisorSecopNombre: c.supervisor,
        supervisorSecopDocumento: c.supervisor ? c.supervisorDocumento : null,
        ...(completar as Prisma.ExpedienteContractualUncheckedUpdateInput),
      },
    }),
  ]);
  if (c.supervisor && c.supervisorDocumento) await vincularSupervisoresSecop({ id: expedienteId });
  const resumen = [
    `Sincronizado con SECOP II (${idContrato})`,
    Object.keys(completar).length ? `actualizado desde SECOP II: ${Object.keys(completar).map((k) => ETIQUETA_CAMPO_SECOP[k] ?? k).join(", ")}` : null,
  ].filter(Boolean);
  const avanzo = expediente.etapaActual === "PRECONTRACTUAL" && !expediente.cerrado && Boolean(c.fechaSuscripcion);
  if (avanzo) await pasarAContractualPorSecop(expedienteId, c.fechaSuscripcion!);
  const anterior = expediente.secop ? jsonEstable(expediente.secop) : null;
  const cambio = anterior !== jsonEstable(secop);
  if (cambio || Object.keys(completar).length > 0 || usuarioId) {
    await registrarEventoContratacion(expedienteId, "SECOP_SINCRONIZADO", `${resumen.join(" · ")}${cambio || Object.keys(completar).length > 0 ? "" : " · sin cambios"}`, usuarioId);
  }
  return { idContrato, completados: Object.keys(completar).length, cambio: cambio || Object.keys(completar).length > 0 };
}

export async function sincronizarSecopTodos(): Promise<{ total: number; ok: number; cambios: number; vinculados: number; errores: string[] }> {
  const expedientes = await db.expedienteContractual.findMany({
    where: {
      eliminado: false,
      OR: [{ idContratoSecop: { not: null } }, { numeroContrato: { not: null } }, { numeroProcesoSecop: { not: null } }, { contratistaId: { not: null } }],
    },
    select: { id: true, numero: true },
  });
  let ok = 0;
  let cambios = 0;
  const errores: string[] = [];
  for (const e of expedientes) {
    try {
      const r = await sincronizarExpedienteSecop(e.id, null);
      ok++;
      if (r.cambio) cambios++;
    } catch (err) {
      errores.push(`${e.numero}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const vinculados = (await autovincularPerfilesPorDocumento()) + (await vincularSupervisoresSecop());
  return { total: expedientes.length, ok, cambios, vinculados, errores };
}

const soloDigitos = (v: string) => v.replace(/\D/g, "");

export async function asegurarPerfilDesdeSecop(contratista: { tipoDocumento: string | null; documento: string | null; nombre: string | null }): Promise<string | null> {
  const documento = contratista.documento ? soloDigitos(contratista.documento) : "";
  if (documento.length < 5 || !contratista.nombre) return null;
  const existente = await db.contratista.findUnique({ where: { identificacion: documento }, select: { id: true } });
  if (existente) return existente.id;
  const juridica = /nit/i.test(contratista.tipoDocumento ?? "");
  const partes = juridica ? { nombres: "", apellidos: "" } : separarNombreCompleto(contratista.nombre);
  const creado = await db.contratista.create({
    data: {
      identificacion: documento,
      tipoPersona: juridica ? "JURIDICA" : "NATURAL",
      nombreORazonSocial: contratista.nombre.trim(),
      nombres: partes.nombres || null,
      apellidos: partes.apellidos || null,
    },
    select: { id: true },
  });
  return creado.id;
}

export async function vincularSupervisoresSecop(filtro: Prisma.ExpedienteContractualWhereInput = {}): Promise<number> {
  const pendientes = await db.expedienteContractual.findMany({
    where: { AND: [{ eliminado: false, supervisorSecopDocumento: { not: null } }, filtro] },
    select: { id: true, supervisorSecopDocumento: true, supervisores: { select: { usuarioId: true } } },
  });
  let vinculados = 0;
  for (const e of pendientes) {
    const usuario = await db.usuario.findFirst({
      where: { cedulaONit: e.supervisorSecopDocumento!, activo: true },
      select: { id: true, nombre: true, rolesContratacion: true, modulosAcceso: true },
    });
    if (!usuario || e.supervisores.some((s) => s.usuarioId === usuario.id)) continue;
    const faltaRol =
      !usuario.rolesContratacion.includes("CONTRATISTA") &&
      (!usuario.rolesContratacion.includes("SUPERVISOR_INTERVENTOR") || !usuario.modulosAcceso.includes("GECON"));
    await db.$transaction([
      db.expedienteContractualSupervisor.create({ data: { expedienteId: e.id, usuarioId: usuario.id } }),
      ...(faltaRol
        ? [
            db.usuario.update({
              where: { id: usuario.id },
              data: {
                rolesContratacion: [...new Set([...usuario.rolesContratacion, "SUPERVISOR_INTERVENTOR" as const])],
                modulosAcceso: [...new Set([...usuario.modulosAcceso, "GECON" as const])],
              },
            }),
          ]
        : []),
    ]);
    await registrarEventoContratacion(e.id, "SUPERVISORES_ACTUALIZADOS", `Supervisor vinculado desde SECOP II: ${usuario.nombre}`, null);
    vinculados++;
  }
  return vinculados;
}

export async function vincularSupervisionesDeUsuario(usuarioId: string): Promise<number> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: { cedulaONit: true, activo: true } });
  const documento = u?.cedulaONit ? soloDigitos(u.cedulaONit) : "";
  if (!u?.activo || documento.length < 5) return 0;
  return vincularSupervisoresSecop({ supervisorSecopDocumento: documento });
}

export async function autovincularPerfilesPorDocumento(): Promise<number> {
  const pendientes = await db.contratista.findMany({ where: { usuarioId: null } });
  let vinculados = 0;
  for (const p of pendientes) {
    const usuario = await db.usuario.findFirst({ where: { cedulaONit: p.identificacion, activo: true }, select: { id: true } });
    if (usuario && (await vincularPerfilConUsuario(p, usuario.id))) vinculados++;
  }
  return vinculados;
}

export async function solicitarVinculacionContratista(usuarioId: string, documentoIngresado: string) {
  const documento = soloDigitos(documentoIngresado);
  if (documento.length < 5) throw new Error("Escriba su número de documento sin puntos ni espacios.");
  const [yaContratista, pendiente] = await Promise.all([
    db.contratista.findUnique({ where: { usuarioId }, select: { id: true } }),
    db.contratista.findFirst({ where: { identificacion: documento, usuarioId: null }, select: { id: true, nombreORazonSocial: true } }),
  ]);
  if (yaContratista) throw new Error("Su usuario ya está vinculado como contratista.");
  if (!pendiente) {
    throw new Error("No hay un contrato pendiente de vincular con ese documento. Si su contrato ya fue registrado, comuníquese con la Oficina de Contratación.");
  }
  await db.solicitudVinculacionContratista.upsert({
    where: { usuarioId_contratistaId: { usuarioId, contratistaId: pendiente.id } },
    create: { usuarioId, contratistaId: pendiente.id, documento },
    update: { documento, estado: "PENDIENTE", resueltaEn: null, resueltaPorId: null },
  });
  return { contratista: pendiente.nombreORazonSocial };
}

export async function listarSolicitudesVinculacion() {
  const solicitudes = await db.solicitudVinculacionContratista.findMany({ where: { estado: "PENDIENTE" }, orderBy: { createdAt: "asc" } });
  if (solicitudes.length === 0) return [];
  const [usuarios, contratistas] = await Promise.all([
    db.usuario.findMany({ where: { id: { in: solicitudes.map((s) => s.usuarioId) } }, select: { id: true, nombre: true, email: true, directorioActivo: true } }),
    db.contratista.findMany({ where: { id: { in: solicitudes.map((s) => s.contratistaId) } }, select: { id: true, nombreORazonSocial: true, identificacion: true } }),
  ]);
  return solicitudes.map((s) => ({
    id: s.id,
    documento: s.documento,
    creada: s.createdAt,
    usuario: usuarios.find((u) => u.id === s.usuarioId) ?? null,
    contratista: contratistas.find((c) => c.id === s.contratistaId) ?? null,
  }));
}

export async function resolverSolicitudVinculacion(id: string, aprobar: boolean, resueltaPorId: string) {
  const s = await db.solicitudVinculacionContratista.findUnique({ where: { id } });
  if (!s || s.estado !== "PENDIENTE") throw new Error("La solicitud ya no está pendiente.");
  if (aprobar) {
    const pendiente = await db.contratista.findUnique({ where: { id: s.contratistaId } });
    if (!pendiente || pendiente.usuarioId) throw new Error("El contratista ya está vinculado a otro usuario.");
    const ok = await vincularPerfilConUsuario(pendiente, s.usuarioId);
    if (!ok) throw new Error("No se pudo vincular: el usuario ya es contratista, tiene otro documento registrado o no puede ser contratista.");
  }
  await db.solicitudVinculacionContratista.update({
    where: { id },
    data: { estado: aprobar ? "APROBADA" : "RECHAZADA", resueltaEn: new Date(), resueltaPorId },
  });
}

export async function debeOfrecerVinculacion(usuarioId: string): Promise<boolean> {
  const [usuario, pendientes, solicitud] = await Promise.all([
    db.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true, cedulaONit: true, modulosAcceso: true, rolesContratacion: true, contratista: { select: { id: true } } },
    }),
    db.contratista.count({ where: { usuarioId: null } }),
    db.solicitudVinculacionContratista.count({ where: { usuarioId, estado: "PENDIENTE" } }),
  ]);
  if (!usuario || usuario.rol === "ADMIN" || usuario.contratista || usuario.cedulaONit?.trim()) return false;
  if (usuario.modulosAcceso.length > 0 || usuario.rolesContratacion.length > 0) return false;
  return pendientes > 0 && solicitud === 0;
}
