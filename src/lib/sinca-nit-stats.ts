import { buscarNits } from "@/lib/sinca";
import { agruparEntidadesNit, type EntidadNit } from "@/lib/sinca-nit";
import { db } from "@/lib/db";

export type SnapshotNit = {
  entidades: EntidadNit[];
  totalVinculaciones: number;
  calculadoEn: string;
};

const ID_SNAPSHOT = "actual";
const VIGENCIA_MS = 12 * 3600 * 1000; // 12 horas

// Leer la fila de ~11MB desde Postgres (aunque ya esté calculada) toma varios segundos —
// se guarda también en memoria del propio proceso para que las visitas seguidas (paginar,
// cambiar un filtro) no repitan esa lectura cada vez. Se pierde al reiniciar el servidor o
// en una instancia nueva de Vercel, lo cual está bien: en ese caso simplemente vuelve a leer
// de la base (sigue siendo mucho más rápido que recalcular contra el API).
let enMemoria: { snapshot: SnapshotNit; hasta: number } | null = null;

/**
 * Barre TODO el registro de NIT/terceros de SINCA 1.0 (33k+ filas, una sola llamada con
 * `per_page=-1` — tarda ~20s) y lo agrupa por tercero. Tanto el listado (/historico/nits) como
 * el panel de estadísticas leen de este mismo snapshot en vez de volver a golpear el API cada uno
 * por su lado — antes el listado traía solo una muestra acotada (5.000 filas) para poder paginar
 * rápido, y el panel de estadísticas escaneaba el total completo por separado: dos números de
 * "total" distintos en la misma pantalla, que es justo lo que generó la confusión. Con una sola
 * fuente, el listado, su paginación y las estadísticas siempre cuadran entre sí.
 */
async function calcularSnapshotNit(): Promise<SnapshotNit> {
  const [r, locales] = await Promise.all([
    buscarNits({ perPage: -1, page: 1 }),
    db.sincaResolucion.findMany({ select: { nroSolicitud: true } }),
  ]);
  const disponibles = new Set(locales.map((x) => x.nroSolicitud));
  const entidades = agruparEntidadesNit(r.data, disponibles);
  return { entidades, totalVinculaciones: r.total, calculadoEn: new Date().toISOString() };
}

/**
 * Guardado en una tabla propia (`SincaNitSnapshot`, fila única) en vez de con `unstable_cache`:
 * el payload agrupado pesa ~12MB, por encima de los 2MB que esa caché admite — probado en vivo,
 * fallaba en silencio (no cacheaba nada y recalculaba en cada visita, ~20s cada vez).
 */
export async function obtenerSnapshotNit(): Promise<SnapshotNit> {
  if (enMemoria && Date.now() < enMemoria.hasta) return enMemoria.snapshot;

  const existente = await db.sincaNitSnapshot.findUnique({ where: { id: ID_SNAPSHOT } });
  if (existente && Date.now() - existente.calculadoEn.getTime() < VIGENCIA_MS) {
    const snapshot = existente.datos as unknown as SnapshotNit;
    enMemoria = { snapshot, hasta: Date.now() + VIGENCIA_MS };
    return snapshot;
  }

  const snapshot = await calcularSnapshotNit();
  await db.sincaNitSnapshot.upsert({
    where: { id: ID_SNAPSHOT },
    create: { id: ID_SNAPSHOT, datos: snapshot, calculadoEn: new Date() },
    update: { datos: snapshot, calculadoEn: new Date() },
  });
  enMemoria = { snapshot, hasta: Date.now() + VIGENCIA_MS };
  return snapshot;
}
