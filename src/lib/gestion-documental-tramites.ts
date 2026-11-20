import type { NivelAccesoInformacion } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ESTADOS_TERMINALES_EXPEDIENTE, tramiteFinalizado } from "@/lib/estados-expediente";
import { cancelarFlujosDeObjeto } from "@/lib/flujos";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import {
  MENSAJE_EXPEDIENTE_CERRADO,
  firmasPendientesTramite,
  mensajeFirmasPendientes,
  validarFundamentoNivelAcceso,
} from "@/lib/archivo-central";

async function subserieVigente(subserieId: string) {
  const s = await db.subserieDocumental.findUnique({
    where: { id: subserieId },
    select: { id: true, codigo: true, nombre: true, activo: true, serie: { select: { activo: true, vigenteHasta: true } } },
  });
  if (!s || !s.activo || !s.serie.activo || s.serie.vigenteHasta) throw new Error("La subserie TRD elegida no existe o no está vigente.");
  return { id: s.id, etiqueta: `${s.codigo} — ${s.nombre}` };
}

async function expedienteAbierto(expedienteId: string) {
  const e = await db.expediente.findUnique({
    where: { id: expedienteId },
    select: {
      numero: true,
      estado: true,
      fechaCierre: true,
      archivado: true,
      subserieId: true,
      nivelAcceso: true,
      subserie: { select: { codigo: true, nombre: true } },
    },
  });
  if (!e) throw new Error("El expediente no existe.");
  if (e.archivado) throw new Error(MENSAJE_EXPEDIENTE_CERRADO);
  return e;
}

export async function reclasificarTrdTramite(expedienteId: string, subserieId: string, motivo: string, usuarioId: string) {
  if (!motivo.trim()) throw new Error("Indique el motivo de la clasificación.");
  const actual = await expedienteAbierto(expedienteId);
  const nueva = await subserieVigente(subserieId);
  if (nueva.id === actual.subserieId) throw new Error("El expediente ya tiene esa clasificación.");
  await db.expediente.update({ where: { id: expedienteId }, data: { subserieId: nueva.id, fechaUltimoMovimiento: new Date() } });
  const anterior = actual.subserie ? `${actual.subserie.codigo} — ${actual.subserie.nombre}` : "sin clasificación";
  await db.expedienteEvento.create({
    data: {
      expedienteId,
      tipo: "TRD_RECLASIFICADA",
      descripcion: `TRD: ${anterior} → ${nueva.etiqueta}. Motivo: ${motivo.trim()}`,
      usuarioId,
    },
  });
  return nueva;
}

export async function cambiarNivelAccesoTramite(
  expedienteId: string,
  nivelAcceso: NivelAccesoInformacion,
  fundamento: string,
  usuarioId: string
) {
  validarFundamentoNivelAcceso(nivelAcceso, fundamento);
  const actual = await expedienteAbierto(expedienteId);
  await db.expediente.update({
    where: { id: expedienteId },
    data: { nivelAcceso, fundamentoNivelAcceso: nivelAcceso === "PUBLICA" ? null : fundamento.trim() },
  });
  await db.expedienteEvento.create({
    data: {
      expedienteId,
      tipo: "NIVEL_ACCESO_CAMBIADO",
      descripcion: `Nivel de acceso: ${ETIQUETA_NIVEL_ACCESO[actual.nivelAcceso]} → ${ETIQUETA_NIVEL_ACCESO[nivelAcceso]}${
        nivelAcceso === "PUBLICA" ? "" : `. Fundamento: ${fundamento.trim()}`
      }`,
      usuarioId,
    },
  });
}

export async function cerrarExpedienteTramite(expedienteId: string, usuarioId: string) {
  const actual = await expedienteAbierto(expedienteId);
  if (!(ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(actual.estado)) {
    throw new Error("Solo se cierra un expediente cuyo trámite ya tiene un estado final (aprobado, negado, desistido, archivado o rechazado).");
  }
  if (!tramiteFinalizado(actual)) {
    throw new Error("El trámite ya tiene decisión pero no ha finalizado: complete los pasos que faltan (notificación) y use «Finalizar trámite» en el último paso.");
  }
  if (!actual.subserieId) throw new Error("Asigne la clasificación TRD antes de cerrar el expediente.");
  const pendientes = await firmasPendientesTramite(expedienteId);
  if (pendientes > 0) throw new Error(mensajeFirmasPendientes(pendientes));
  const visitasProgramadas = await db.visitaProgramada.count({ where: { expedienteId, estado: "PROGRAMADA" } });
  if (visitasProgramadas > 0) {
    throw new Error(`Hay ${visitasProgramadas} visita(s) programada(s) en este expediente: regístrelas o cancélelas antes de cerrarlo.`);
  }
  const conceptosAbiertos = await db.visitaTecnica.count({
    where: { expedienteId, visitaProgramadaId: { not: null }, formatoVersionId: { not: null }, finalizadaEn: null, conceptoDescartadoEn: null },
  });
  if (conceptosAbiertos > 0) {
    throw new Error(
      `Hay ${conceptosAbiertos} concepto(s) técnico(s) sin terminar: envíelos a firma o, si no se van a terminar, use «Descartar borrador» en el concepto antes de cerrar el expediente.`
    );
  }

  const ahora = new Date();
  await db.expediente.update({
    where: { id: expedienteId },
    data: { archivado: true, archivadoEn: ahora, archivadoPorId: usuarioId, fechaUltimoMovimiento: ahora },
  });
  // Por ahora el expediente de trámites se archiva como expediente digital propio del módulo
  // (sección «Expedientes archivados»); ya no se envía al SGDEA (sincronizarArchivoTramite queda
  // disponible para cuando se use).
  await db.expedienteEvento.create({
    data: {
      expedienteId,
      tipo: "EXPEDIENTE_ARCHIVADO",
      descripcion: `Expediente digital ${actual.numero} cerrado y archivado.`,
      usuarioId,
    },
  });
  await cancelarFlujosDeObjeto("TRAMITE", expedienteId, usuarioId, "se cerró y archivó el expediente.").catch((e) => console.error("cancelarFlujosDeObjeto falló:", e));
}

export async function reabrirExpedienteTramite(expedienteId: string, motivo: string, usuarioId: string) {
  if (!motivo.trim()) throw new Error("Reabrir un expediente cerrado exige indicar el motivo.");
  const e = await db.expediente.findUnique({ where: { id: expedienteId }, select: { archivado: true } });
  if (!e) throw new Error("El expediente no existe.");
  if (!e.archivado) throw new Error("Este expediente no está cerrado.");
  await db.expediente.update({
    where: { id: expedienteId },
    data: { archivado: false, archivadoEn: null, archivadoPorId: null, fechaUltimoMovimiento: new Date() },
  });
  await db.expedienteEvento.create({
    data: { expedienteId, tipo: "EXPEDIENTE_REABIERTO", descripcion: `Expediente reabierto. Motivo: ${motivo.trim()}`, usuarioId },
  });
}
