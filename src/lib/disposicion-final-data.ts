import { db } from "@/lib/db";
import { calcularFaseArchivistica } from "@/lib/disposicion-final";

/**
 * Comunicaciones cuya subserie tiene retención REAL configurada (> 0 años de
 * gestión) — se excluyen a propósito las que quedaron en 0/0 (el valor por
 * defecto de una subserie recién creada, ej. "SIN-CLASIF"): un 0 casi
 * siempre significa "todavía no se configuró", no una política real de
 * retención cero, y mostrarlas inundaría el panel de falsos pendientes.
 */
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
  // MoReq 2.10: aviso anticipado — se cuenta cuánto falta para que una comunicación
  // ya transferida entre en disposición final, con 90 días de antelación.
  const umbralAviso = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (const c of comunicaciones) {
    if (!c.subserie) continue;
    // MoReq 2.6: la retención puede contarse desde el cierre del expediente donde
    // quedó archivada, no desde su propia radicación. Si la serie lo pide y todavía
    // no hay un expediente cerrado que la contenga, la retención aún no arrancó.
    let fechaBase = c.fechaRadicacion;
    if (c.serie?.retencionDesde === "CIERRE_EXPEDIENTE") {
      if (c.expedienteDocumental?.estado === "CERRADO" && c.expedienteDocumental.fechaCierre) {
        fechaBase = c.expedienteDocumental.fechaCierre;
      } else {
        continue; // aún no empieza a correr la retención
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
    // MoReq 2.17: una transferencia registrada pero sin confirmar la recepción en
    // archivo central se "conserva" — no avanza a disposición final hasta que un
    // administrador confirme que el proceso concluyó.
    if (c.transferidaCentralEn && !c.transferenciaConfirmadaEn) {
      transferidasSinConfirmar.push({ ...c, fechaFinCentral });
      continue;
    }
    // Una disposición aplazada (MoReq 2.11) deja de aparecer como pendiente
    // mientras dure el aplazamiento, aunque ya haya cumplido su retención.
    if (fase === "DISPOSICION_PENDIENTE" && !(c.disposicionAplazadaHasta && c.disposicionAplazadaHasta > ahora)) {
      pendientesDisposicion.push({ ...c, fechaFinCentral });
    }
  }

  proximasADisponer.sort((a, b) => a.fechaFinCentral.getTime() - b.fechaFinCentral.getTime());
  return { pendientesTransferencia, pendientesDisposicion, transferidasSinConfirmar, proximasADisponer };
}

/**
 * Estado de las transferencias al archivo central registradas (MoReq 2.16:
 * "reporte del estado de la transferencia realizada"). Devuelve la lista
 * completa con su fecha de transferencia y, si aplica, la de confirmación.
 */
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

/** Disposiciones finales actualmente aplazadas (vigentes) — para que no queden invisibles del todo. */
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
