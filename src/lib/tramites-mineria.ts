import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { construirWhereExpedientes, type FiltrosExpedientes } from "@/lib/expedientes";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_MESES_SERIE = 120;

const ESTADOS_EN_PROCESO = ["RADICADO", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"] as const;
const ESTADOS_FINALIZADOS = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"] as const;

export type FilaDimension = { valor: string; label: string; total: number };

export async function calcularMineriaTramites(f: FiltrosExpedientes) {
  const where = construirWhereExpedientes(f);

  const [total, porTipoRaw, porEstadoRaw, porMunicipioRaw, filtrados] = await Promise.all([
    db.expediente.count({ where }),
    db.expediente.groupBy({ by: ["tramiteTipoId"], where, _count: { _all: true }, orderBy: { _count: { tramiteTipoId: "desc" } } }),
    db.expediente.groupBy({ by: ["estado"], where, _count: { _all: true } }),
    db.expediente.groupBy({ by: ["municipio"], where, _count: { _all: true }, orderBy: { _count: { municipio: "desc" } }, take: 15 }),
    db.expediente.findMany({ where, select: { id: true } }),
  ]);

  const ids = filtrados.map((e) => e.id);

  const [tramitesPorId, mensualRaw, tiempoPorTipoRaw] = await Promise.all([
    db.tramiteTipo.findMany({ where: { id: { in: porTipoRaw.map((p) => p.tramiteTipoId) } }, select: { id: true, nombre: true, codigo: true } }),
    ids.length > 0
      ? db.$queryRaw<{ mes: Date; c: bigint }[]>`
          SELECT date_trunc('month', "fechaRadicacion") mes, COUNT(*) c
          FROM "Expediente" WHERE id IN (${Prisma.join(ids)})
          GROUP BY 1 ORDER BY 1`
      : Promise.resolve([] as { mes: Date; c: bigint }[]),
    ids.length > 0
      ? db.$queryRaw<{ tramiteTipoId: string; diasProm: number | null; n: bigint }[]>`
          SELECT e."tramiteTipoId" AS "tramiteTipoId",
                 AVG(EXTRACT(EPOCH FROM (ev."createdAt" - e."fechaRadicacion")) / 86400) AS "diasProm",
                 COUNT(ev."createdAt") AS n
          FROM "Expediente" e
          JOIN LATERAL (
            SELECT MIN(ee."createdAt") AS "createdAt"
            FROM "ExpedienteEvento" ee
            WHERE ee."expedienteId" = e.id AND ee."estadoNuevo" IN ('APROBADO', 'NEGADO', 'DESISTIDO', 'ARCHIVADO', 'RECHAZADO')
          ) ev ON true
          WHERE e.id IN (${Prisma.join(ids)})
          GROUP BY e."tramiteTipoId"
          HAVING COUNT(ev."createdAt") > 0
          ORDER BY "diasProm" DESC`
      : Promise.resolve([] as { tramiteTipoId: string; diasProm: number | null; n: bigint }[]),
  ]);

  const nombreTramite = new Map(tramitesPorId.map((t) => [t.id, t.nombre]));
  const codigoTramite = new Map(tramitesPorId.map((t) => [t.id, t.codigo]));

  const conteoPorEstado = Object.fromEntries(porEstadoRaw.map((p) => [p.estado, p._count._all])) as Record<string, number>;
  const enProceso = ESTADOS_EN_PROCESO.reduce((s, e) => s + (conteoPorEstado[e] ?? 0), 0);
  const finalizados = ESTADOS_FINALIZADOS.reduce((s, e) => s + (conteoPorEstado[e] ?? 0), 0);

  const porTipo: FilaDimension[] = porTipoRaw
    .map((p) => ({ valor: p.tramiteTipoId, label: nombreTramite.get(p.tramiteTipoId) ?? "—", total: p._count._all }))
    .sort((a, b) => b.total - a.total);
  const porEstado: FilaDimension[] = porEstadoRaw
    .map((p) => ({ valor: p.estado, label: p.estado.replaceAll("_", " "), total: p._count._all }))
    .sort((a, b) => b.total - a.total);
  const porMunicipio: FilaDimension[] = porMunicipioRaw.map((p) => ({ valor: p.municipio, label: p.municipio, total: p._count._all }));

  const hastaSerie = f.rango ? new Date(f.rango.hasta.getTime() - 1) : new Date();
  const desdeSerie = f.rango ? f.rango.desde : new Date(hastaSerie.getFullYear(), hastaSerie.getMonth() - 23, 1);
  const totalMeses = Math.min(
    MAX_MESES_SERIE,
    Math.max(1, (hastaSerie.getFullYear() - desdeSerie.getFullYear()) * 12 + (hastaSerie.getMonth() - desdeSerie.getMonth()) + 1)
  );
  const porMes: FilaDimension[] = [];
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(desdeSerie.getFullYear(), desdeSerie.getMonth() + i, 1);
    const fila = mensualRaw.find((m) => {
      const md = new Date(m.mes);
      return md.getUTCFullYear() === d.getFullYear() && md.getUTCMonth() === d.getMonth();
    });
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    porMes.push({ valor: clave, label: `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: fila ? Number(fila.c) : 0 });
  }

  const tiempoPromedioPorTipo = tiempoPorTipoRaw.map((r) => ({
    tramiteTipoId: r.tramiteTipoId,
    tramite: nombreTramite.get(r.tramiteTipoId) ?? "—",
    codigo: codigoTramite.get(r.tramiteTipoId) ?? "",
    diasPromedio: r.diasProm != null ? Math.round(r.diasProm) : null,
    n: Number(r.n),
  }));

  return {
    total,
    enProceso,
    finalizados,
    tiempoPromedioPorTipo,
    porTipo,
    porEstado,
    porMunicipio,
    porMes,
  };
}

export type MineriaTramites = Awaited<ReturnType<typeof calcularMineriaTramites>>;

export const DIMENSIONES_TABLA = {
  tipo: { etiqueta: "Tipo de trámite", columna: "Tipo de trámite" },
  estado: { etiqueta: "Estado", columna: "Estado" },
  municipio: { etiqueta: "Municipio", columna: "Municipio" },
  mes: { etiqueta: "Mes de radicación", columna: "Mes" },
} as const;

export type DimensionTabla = keyof typeof DIMENSIONES_TABLA;

export function filasDeDimension(m: MineriaTramites, dimension: DimensionTabla): FilaDimension[] {
  if (dimension === "tipo") return m.porTipo;
  if (dimension === "estado") return m.porEstado;
  if (dimension === "municipio") return m.porMunicipio;
  return m.porMes;
}
