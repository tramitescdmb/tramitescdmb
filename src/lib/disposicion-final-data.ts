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
  const comunicaciones = await db.comunicacion.findMany({
    where: {
      fechaDisposicionFinal: null,
      estado: { not: "ANULADA" },
      subserie: { retencionGestionAnios: { gt: 0 } },
    },
    include: {
      subserie: { select: { codigo: true, nombre: true, retencionGestionAnios: true, retencionCentralAnios: true, disposicionFinal: true } },
      serie: { select: { codigo: true, nombre: true } },
    },
    orderBy: { fechaRadicacion: "asc" },
  });

  const pendientesTransferencia = [];
  const pendientesDisposicion = [];

  for (const c of comunicaciones) {
    if (!c.subserie) continue;
    const { fase, fechaFinGestion, fechaFinCentral } = calcularFaseArchivistica(
      c.fechaRadicacion,
      c.subserie.retencionGestionAnios,
      c.subserie.retencionCentralAnios
    );
    if (fase === "TRANSFERENCIA_PENDIENTE" && !c.transferidaCentralEn) {
      pendientesTransferencia.push({ ...c, fechaFinGestion });
    }
    if (fase === "DISPOSICION_PENDIENTE") {
      pendientesDisposicion.push({ ...c, fechaFinCentral });
    }
  }

  return { pendientesTransferencia, pendientesDisposicion };
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
