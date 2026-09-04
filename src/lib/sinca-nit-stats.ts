import { unstable_cache } from "next/cache";
import { buscarNits } from "@/lib/sinca";
import { db } from "@/lib/db";

export type EstadisticasNit = {
  totalTerceros: number;
  conVinculacion: number;
  sinVinculacion: number;
  porcentajeSinVinculacion: number;
  totalVinculaciones: number;
  calculadoEn: string;
};

/**
 * Barre TODO el registro de NIT/terceros de SINCA 1.0 (33k+ filas, una llamada con
 * `per_page=-1` — tarda ~20s) para contar cuántos terceros distintos hay y cuántos de
 * esos no tienen ninguna solicitud con detalle disponible en la plataforma. Pensado
 * para análisis puntual (ej. evaluar si tiene sentido depurar los que nunca se usan),
 * no para consultarse en cada carga de página — por eso va cacheado varias horas
 * (`obtenerEstadisticasNit`, más abajo) y se sirve desde una ruta aparte que el listado
 * carga de forma independiente, para no demorar la tabla principal.
 */
async function calcularEstadisticasNit(): Promise<EstadisticasNit> {
  const [r, locales] = await Promise.all([
    buscarNits({ perPage: -1, page: 1 }),
    db.sincaResolucion.findMany({ select: { nroSolicitud: true } }),
  ]);
  const disponibles = new Set(locales.map((x) => x.nroSolicitud));

  const tieneVinculo = new Map<string, boolean>();
  for (const n of r.data) {
    const clave = n.numero_nit != null ? String(n.numero_nit) : `sin-nit-${n.rn}`;
    const nro = n.nrosolicitud_sol ? Number(n.nrosolicitud_sol) : null;
    const disponible = nro != null && disponibles.has(nro);
    tieneVinculo.set(clave, (tieneVinculo.get(clave) ?? false) || disponible);
  }

  let conVinculacion = 0;
  for (const v of tieneVinculo.values()) if (v) conVinculacion++;
  const totalTerceros = tieneVinculo.size;
  const sinVinculacion = totalTerceros - conVinculacion;

  return {
    totalTerceros,
    conVinculacion,
    sinVinculacion,
    porcentajeSinVinculacion: totalTerceros > 0 ? sinVinculacion / totalTerceros : 0,
    totalVinculaciones: r.total,
    calculadoEn: new Date().toISOString(),
  };
}

export const obtenerEstadisticasNit = unstable_cache(calcularEstadisticasNit, ["sinca-nit-estadisticas"], {
  revalidate: 3600 * 12,
  tags: ["sinca-nit-estadisticas"],
});
