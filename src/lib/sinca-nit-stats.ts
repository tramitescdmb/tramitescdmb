import { buscarNits } from "@/lib/sinca";
import { agruparEntidadesNit, type EntidadNit } from "@/lib/sinca-nit";
import { db } from "@/lib/db";

const VERSION_SNAPSHOT = 3;

export type SnapshotNit = {
  version: number;
  entidades: EntidadNit[];
  totalVinculaciones: number;
  calculadoEn: string;
};

const ID_SNAPSHOT = "actual";
const VIGENCIA_MS = 12 * 3600 * 1000;

let enMemoria: { snapshot: SnapshotNit; hasta: number } | null = null;

async function calcularSnapshotNit(): Promise<SnapshotNit> {
  const [r, locales] = await Promise.all([
    buscarNits({ perPage: -1, page: 1 }),
    db.sincaResolucion.findMany({ select: { nroSolicitud: true } }),
  ]);
  const disponibles = new Set(locales.map((x) => x.nroSolicitud));
  const entidades = agruparEntidadesNit(r.data, disponibles);
  return { version: VERSION_SNAPSHOT, entidades, totalVinculaciones: r.total, calculadoEn: new Date().toISOString() };
}

function vigente(snapshot: SnapshotNit | undefined | null, calculadoEn?: Date): snapshot is SnapshotNit {
  if (!snapshot || snapshot.version !== VERSION_SNAPSHOT) return false;
  if (calculadoEn && Date.now() - calculadoEn.getTime() >= VIGENCIA_MS) return false;
  return true;
}

export async function refrescarSnapshotNit(): Promise<SnapshotNit> {
  const snapshot = await calcularSnapshotNit();
  await db.sincaNitSnapshot.upsert({
    where: { id: ID_SNAPSHOT },
    create: { id: ID_SNAPSHOT, datos: snapshot, calculadoEn: new Date() },
    update: { datos: snapshot, calculadoEn: new Date() },
  });
  enMemoria = { snapshot, hasta: Date.now() + VIGENCIA_MS };
  return snapshot;
}

export async function obtenerSnapshotNit(): Promise<SnapshotNit> {
  if (vigente(enMemoria?.snapshot) && enMemoria && Date.now() < enMemoria.hasta) return enMemoria.snapshot;

  const existente = await db.sincaNitSnapshot.findUnique({ where: { id: ID_SNAPSHOT } });
  const snapshotGuardado = existente?.datos as unknown as SnapshotNit | undefined;
  if (vigente(snapshotGuardado, existente?.calculadoEn)) {
    enMemoria = { snapshot: snapshotGuardado, hasta: Date.now() + VIGENCIA_MS };
    return snapshotGuardado;
  }

  return refrescarSnapshotNit();
}
