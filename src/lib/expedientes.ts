import type { Prisma, EstadoExpediente } from "@prisma/client";
import { db } from "@/lib/db";
import { generarNumeroTramite } from "@/lib/consecutivos";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

export type FiltrosExpedientes = {
  tramiteIdsPermitidos: string[] | null;
  expedienteIdsAsignados?: string[];
  estado?: string;
  tramite?: string;
  tramites?: string[];
  municipio?: string;
  rango: RangoPeriodo;
  busqueda?: string;
  soloMios?: boolean;
  usuarioId?: string;
  cargos?: string[];
};

// Compartido entre la lista de /expedientes, la exportación (XLSX/CSV) y el módulo de minería
// (/mineria): así se garantiza, por construcción, que todos cuenten exactamente lo mismo.
export function construirWhereExpedientes(f: FiltrosExpedientes): Prisma.ExpedienteWhereInput {
  const filtros: Prisma.ExpedienteWhereInput[] = [];
  if (f.tramiteIdsPermitidos) {
    filtros.push(
      f.expedienteIdsAsignados?.length
        ? { OR: [{ tramiteTipoId: { in: f.tramiteIdsPermitidos } }, { id: { in: f.expedienteIdsAsignados } }] }
        : { tramiteTipoId: { in: f.tramiteIdsPermitidos } }
    );
  }
  if (f.estado === "EN_CURSO") filtros.push({ estado: { in: ["RADICADO", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"] } });
  else if (f.estado === "NEGADOS") filtros.push({ estado: { in: ["NEGADO", "RECHAZADO"] } });
  else if (f.estado) filtros.push({ estado: f.estado as EstadoExpediente });
  if (f.tramite) filtros.push({ tramiteTipoId: { in: f.tramite.split(",").filter(Boolean) } });
  if (f.tramites && f.tramites.length > 0) filtros.push({ tramiteTipoId: { in: f.tramites } });
  if (f.municipio) filtros.push({ municipio: f.municipio });
  if (f.rango) filtros.push({ fechaRadicacion: { gte: f.rango.desde, lt: f.rango.hasta } });
  if (f.busqueda) {
    filtros.push({
      OR: [
        { numero: { contains: f.busqueda, mode: "insensitive" } },
        { solicitanteNombre: { contains: f.busqueda, mode: "insensitive" } },
        { solicitanteIdentificacion: { contains: f.busqueda, mode: "insensitive" } },
      ],
    });
  }
  if (f.soloMios && f.usuarioId) {
    filtros.push({
      OR: [
        { usuariosAsignados: { some: { id: f.usuarioId } } },
        ...(f.cargos && f.cargos.length > 0 ? [{ cargosAsignados: { some: { nombre: { in: f.cargos } } } }] : []),
      ],
    });
  }
  return filtros.length ? { AND: filtros } : {};
}

// Años con al menos un expediente radicado — para los accesos rápidos de "vigencia" del listado.
// DISTINCT/EXTRACT no tiene equivalente directo en Prisma, de ahí el SQL crudo (de solo lectura).
export async function aniosConRadicacion(): Promise<number[]> {
  const filas = await db.$queryRaw<{ anio: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM "fechaRadicacion")::int AS anio
    FROM "Expediente"
    ORDER BY anio DESC
  `;
  return filas.map((f) => f.anio);
}

export async function generarNumeroExpediente(tramiteCodigo: string) {
  return generarNumeroTramite(tramiteCodigo);
}
