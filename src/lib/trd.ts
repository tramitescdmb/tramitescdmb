import { db } from "@/lib/db";

/**
 * Series documentales VIGENTES (versión actual: sin `vigenteHasta`) con sus
 * subseries activas — para clasificar al radicar. La TRD se versiona: una serie
 * "cerrada" (vigenteHasta con fecha) es de una versión anterior y no se ofrece
 * para clasificar nuevo, pero se conserva para lo ya clasificado y para migrar.
 */
export async function listarSeriesVigentes() {
  return db.serieDocumental.findMany({
    where: { activo: true, vigenteHasta: null },
    orderBy: [{ codigo: "asc" }],
    include: {
      subseries: { where: { activo: true }, orderBy: { codigo: "asc" } },
    },
  });
}

/** Todas las series (para el admin de TRD/CCD). */
export async function listarSeries() {
  return db.serieDocumental.findMany({
    orderBy: [{ codigo: "asc" }, { version: "asc" }],
    include: {
      dependencia: { select: { nombre: true } },
      subseries: { orderBy: { codigo: "asc" } },
      _count: { select: { comunicaciones: true } },
    },
  });
}

export const ETIQUETA_DISPOSICION: Record<string, string> = {
  CONSERVACION_TOTAL: "Conservación total",
  ELIMINACION: "Eliminación",
  SELECCION: "Selección",
  MICROFILMACION_DIGITALIZACION: "Microfilmación / Digitalización",
};
