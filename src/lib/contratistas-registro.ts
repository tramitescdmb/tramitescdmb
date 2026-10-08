import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const CONTRATO_ACTIVO = { eliminado: false, cerrado: false, etapaActual: "CONTRACTUAL" } satisfies Prisma.ExpedienteContractualWhereInput;

export function filtroVigencia(vigencia: number): Prisma.ExpedienteContractualWhereInput {
  const desde = new Date(vigencia, 0, 1);
  const hasta = new Date(vigencia + 1, 0, 1);
  return {
    eliminado: false,
    OR: [{ fechaInicio: { gte: desde, lt: hasta } }, { fechaInicio: null, createdAt: { gte: desde, lt: hasta } }],
  };
}

export function filtroContratistas({
  busqueda,
  vigencia,
  estado,
}: {
  busqueda: string;
  vigencia: number | null;
  estado: "" | "activo" | "inactivo";
}): Prisma.ContratistaWhereInput {
  const condiciones: Prisma.ContratistaWhereInput[] = [];
  for (const p of busqueda.split(/\s+/).filter(Boolean).slice(0, 4)) {
    condiciones.push({
      OR: [
        { identificacion: { contains: p, mode: "insensitive" } },
        { nombreORazonSocial: { contains: p, mode: "insensitive" } },
        { nombres: { contains: p, mode: "insensitive" } },
        { apellidos: { contains: p, mode: "insensitive" } },
      ],
    });
  }
  if (vigencia) condiciones.push({ expedientes: { some: filtroVigencia(vigencia) } });
  if (estado === "activo") condiciones.push({ expedientes: { some: CONTRATO_ACTIVO } });
  if (estado === "inactivo") condiciones.push({ expedientes: { none: CONTRATO_ACTIVO } });
  return condiciones.length > 0 ? { AND: condiciones } : {};
}

export async function vigenciasDisponibles(): Promise<number[]> {
  const filas = await db.$queryRaw<{ v: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM COALESCE("fechaInicio", "createdAt"))::int AS v
    FROM "ExpedienteContractual"
    WHERE NOT "eliminado"
    ORDER BY v DESC`;
  const anioActual = new Date().getFullYear();
  return Array.from(new Set([anioActual, ...filas.map((f) => Number(f.v))])).sort((a, b) => b - a);
}
