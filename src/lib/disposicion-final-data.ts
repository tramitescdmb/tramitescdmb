import { db } from "@/lib/db";
import { calcularFaseArchivistica } from "@/lib/disposicion-final";

export async function getPendientesArchivisticos() {
  const ahora = new Date();
  const comunicaciones = await db.comunicacion.findMany({
    where: {
      fechaDisposicionFinal: null,
      estado: { not: "ANULADA" },
      subserie: { retencionGestionAnios: { gt: 0 } },
    },
    include: {
      subserie: { select: { codigo: true, nombre: true, retencionGestionAnios: true, retencionCentralAnios: true, disposicionesFinal: true } },
      serie: { select: { codigo: true, nombre: true, retencionDesde: true } },
      expedienteDocumental: { select: { estado: true, fechaCierre: true } },
    },
    orderBy: { fechaRadicacion: "asc" },
  });

  const pendientesTransferencia = [];
  const pendientesDisposicion = [];
  const transferidasSinConfirmar = [];
  const proximasADisponer = [];
  const umbralAviso = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (const c of comunicaciones) {
    if (!c.subserie) continue;
    let fechaBase = c.fechaRadicacion;
    if (c.serie?.retencionDesde === "CIERRE_EXPEDIENTE") {
      if (c.expedienteDocumental?.estado === "CERRADO" && c.expedienteDocumental.fechaCierre) {
        fechaBase = c.expedienteDocumental.fechaCierre;
      } else {
        continue;
      }
    }
    const { fase, fechaFinGestion, fechaFinCentral } = calcularFaseArchivistica(
      fechaBase,
      c.subserie.retencionGestionAnios,
      c.subserie.retencionCentralAnios
    );
    if (fase === "TRANSFERENCIA_PENDIENTE" && !c.transferidaCentralEn) {
      pendientesTransferencia.push({ ...c, fechaFinGestion });
    }
    if (fase !== "DISPOSICION_PENDIENTE" && fechaFinCentral <= umbralAviso && fechaFinCentral > ahora) {
      proximasADisponer.push({ ...c, fechaFinCentral });
    }
    if (c.transferidaCentralEn && !c.transferenciaConfirmadaEn) {
      transferidasSinConfirmar.push({ ...c, fechaFinCentral });
      continue;
    }
    if (fase === "DISPOSICION_PENDIENTE" && !(c.disposicionAplazadaHasta && c.disposicionAplazadaHasta > ahora)) {
      pendientesDisposicion.push({ ...c, fechaFinCentral });
    }
  }

  proximasADisponer.sort((a, b) => a.fechaFinCentral.getTime() - b.fechaFinCentral.getTime());
  return { pendientesTransferencia, pendientesDisposicion, transferidasSinConfirmar, proximasADisponer };
}

export async function listarTransferenciasCentral() {
  const filas = await db.comunicacion.findMany({
    where: { transferidaCentralEn: { not: null } },
    select: {
      id: true,
      radicado: true,
      asunto: true,
      transferidaCentralEn: true,
      transferenciaConfirmadaEn: true,
      transferenciaConfirmadaPor: { select: { nombre: true } },
      serie: { select: { codigo: true } },
      subserie: { select: { codigo: true } },
    },
    orderBy: { transferidaCentralEn: "desc" },
  });
  return {
    filas,
    total: filas.length,
    confirmadas: filas.filter((f) => f.transferenciaConfirmadaEn).length,
    sinConfirmar: filas.filter((f) => !f.transferenciaConfirmadaEn).length,
  };
}

export async function getDisposicionesAplazadas() {
  return db.comunicacion.findMany({
    where: { disposicionAplazadaHasta: { gt: new Date() } },
    select: { id: true, radicado: true, asunto: true, disposicionAplazadaHasta: true, motivoAplazamiento: true },
    orderBy: { disposicionAplazadaHasta: "asc" },
  });
}

export async function listarActasEliminacion() {
  return db.actaEliminacion.findMany({
    orderBy: { fecha: "desc" },
    include: {
      aprobadaPor: { select: { nombre: true } },
      comunicaciones: { select: { id: true, radicado: true, asunto: true } },
    },
  });
}
