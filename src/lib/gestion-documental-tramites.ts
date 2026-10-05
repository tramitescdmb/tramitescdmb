import type { NivelAccesoInformacion } from "@prisma/client";
import { db } from "@/lib/db";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import {
  MENSAJE_EXPEDIENTE_CERRADO,
  firmasPendientesTramite,
  mensajeFirmasPendientes,
  sincronizarArchivoTramite,
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
  if (!actual.subserieId) throw new Error("Asigne la clasificación TRD antes de cerrar el expediente.");
  const pendientes = await firmasPendientesTramite(expedienteId);
  if (pendientes > 0) throw new Error(mensajeFirmasPendientes(pendientes));

  const ahora = new Date();
  await db.expediente.update({
    where: { id: expedienteId },
    data: { archivado: true, archivadoEn: ahora, archivadoPorId: usuarioId, fechaUltimoMovimiento: ahora },
  });
  try {
    await sincronizarArchivoTramite(expedienteId);
  } catch (err) {
    await db.expediente.update({ where: { id: expedienteId }, data: { archivado: false, archivadoEn: null, archivadoPorId: null } });
    throw err;
  }
  await db.expedienteEvento.create({
    data: {
      expedienteId,
      tipo: "EXPEDIENTE_ARCHIVADO",
      descripcion: `Expediente ${actual.numero} cerrado y archivado en el SGDEA.`,
      usuarioId,
    },
  });
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
  await sincronizarArchivoTramite(expedienteId);
  await db.expedienteEvento.create({
    data: { expedienteId, tipo: "EXPEDIENTE_REABIERTO", descripcion: `Expediente reabierto. Motivo: ${motivo.trim()}`, usuarioId },
  });
}
