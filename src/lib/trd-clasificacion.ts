// Datos para la pantalla de administración /admin/trd — preclasificación TRD de Trámites 2.0 y GECON
// (reusa el catálogo de series/subseries/tipos documentales del SGDEA, ya real y completo).
import { db } from "@/lib/db";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import type { SerieBuscable } from "@/components/BuscadorSubserieTRD";
import type { ModalidadSeleccion } from "@prisma/client";

// Mismo catálogo que ya usan los formularios de radicar del SGDEA (BuscadorSubserieTRD) — un solo
// origen de datos para el selector en cascada dependencia → serie → subserie en toda la aplicación.
export async function catalogoSeriesBuscables(): Promise<SerieBuscable[]> {
  const series = await listarSeriesVigentes();
  return series.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    dependenciaId: s.dependencia?.id ?? null,
    dependenciaNombre: s.dependencia?.nombre ?? null,
    subseries: s.subseries.map(subserieBuscable),
  }));
}

export async function subseriesPorModalidad(): Promise<Partial<Record<ModalidadSeleccion, string>>> {
  const filas = await db.trdModalidadContratacion.findMany({ select: { modalidad: true, subserieId: true } });
  return Object.fromEntries(filas.map((f) => [f.modalidad, f.subserieId]));
}

export async function subserieDeModalidad(modalidad: ModalidadSeleccion): Promise<{ subserieId: string; motivo: string } | null> {
  const fila = await db.trdModalidadContratacion.findUnique({ where: { modalidad }, select: { subserieId: true } });
  if (fila) return { subserieId: fila.subserieId, motivo: "según su modalidad de contratación" };
  const respaldo = await subserieContratacionActual();
  return respaldo ? { subserieId: respaldo, motivo: "subserie de respaldo de GECON (la modalidad no tiene subserie asignada)" } : null;
}

export async function tiposDocumentalesPorSubserie() {
  const tipos = await db.tipoDocumental.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, subserieId: true } });
  const mapa = new Map<string, { id: string; nombre: string }[]>();
  for (const t of tipos) {
    const lista = mapa.get(t.subserieId) ?? [];
    lista.push({ id: t.id, nombre: t.nombre });
    mapa.set(t.subserieId, lista);
  }
  return mapa;
}

export async function tramitesParaClasificar() {
  return db.tramiteTipo.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      subserieId: true,
      documentosRequeridos: { orderBy: { orden: "asc" }, select: { id: true, nombre: true, tipoDocumentalId: true } },
    },
  });
}

export async function requisitosContratacionParaClasificar() {
  return db.requisitoDocumentoContratacion.findMany({
    where: { activo: true },
    orderBy: [{ etapa: "asc" }, { orden: "asc" }],
    select: { id: true, nombre: true, etapa: true, tipoDocumentalId: true },
  });
}

export async function subserieContratacionActual() {
  const config = await db.configuracionSitio.findUnique({ where: { id: "singleton" }, select: { subserieContratacionId: true } });
  return config?.subserieContratacionId ?? null;
}
