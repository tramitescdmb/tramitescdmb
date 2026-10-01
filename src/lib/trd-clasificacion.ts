// Datos para la pantalla de administración /admin/trd — preclasificación TRD de Trámites 2.0 y GECON
// (reusa el catálogo de series/subseries/tipos documentales del SGDEA, ya real y completo).
import { db } from "@/lib/db";

// El código de serie SE REPITE en las 29 dependencias (ver [[project_sgdea_correspondencia]]) — una
// lista plana global de subseries es ambigua (p.ej. "Actas de Comité Primario" existe decenas de
// veces). Por eso se agrupa SIEMPRE por dependencia, mismo criterio ya establecido para la TRD del
// SGDEA.
export async function catalogoSubseriesPorDependencia() {
  const series = await db.serieDocumental.findMany({
    where: { vigenteHasta: null, activo: true },
    orderBy: { codigo: "asc" },
    select: {
      codigo: true,
      nombre: true,
      dependencia: { select: { nombre: true } },
      subseries: { where: { activo: true }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nombre: true } },
    },
  });
  const porDependencia = new Map<string, { id: string; etiqueta: string }[]>();
  for (const s of series) {
    const dep = s.dependencia?.nombre ?? "Sin dependencia asignada";
    const lista = porDependencia.get(dep) ?? [];
    for (const sub of s.subseries) {
      lista.push({ id: sub.id, etiqueta: `${s.codigo}.${sub.codigo} — ${s.nombre} / ${sub.nombre}` });
    }
    porDependencia.set(dep, lista);
  }
  return [...porDependencia.entries()]
    .filter(([, subseries]) => subseries.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dependencia, subseries]) => ({ dependencia, subseries }));
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
