import { db } from "@/lib/db";

export async function listarSeriesVigentes() {
  return db.serieDocumental.findMany({
    where: { activo: true, vigenteHasta: null },
    orderBy: [{ codigo: "asc" }],
    include: {
      dependencia: { select: { id: true, nombre: true } },
      subseries: { where: { activo: true }, orderBy: { codigo: "asc" } },
    },
  });
}

export async function listarSeries() {
  return db.serieDocumental.findMany({
    orderBy: [{ codigo: "asc" }, { version: "asc" }],
    include: {
      dependencia: { select: { codigo: true, nombre: true } },
      subseries: { orderBy: { codigo: "asc" } },
      _count: { select: { comunicaciones: true } },
    },
  });
}

export { ETIQUETA_DISPOSICION } from "@/lib/trd-presentacion";
