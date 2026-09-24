import { db } from "@/lib/db";
import { deleteDocumento } from "@/lib/storage";

export type ResultadoReinicioPruebas = {
  comunicaciones: number;
  firmas: number;
  archivosStorage: number;
  archivosStorageConError: number;
  solicitantes: number;
  seriesConsecutivoReiniciadas: number;
};

const SERIES_CORRESPONDENCIA = ["R", "E", "I"] as const;

export async function reiniciarDatosPruebaSgdea(): Promise<ResultadoReinicioPruebas> {
  const comunicaciones = await db.comunicacion.findMany({ select: { id: true, terceroId: true } });
  const ids = comunicaciones.map((c) => c.id);
  const tercerosCandidatos = new Set(comunicaciones.map((c) => c.terceroId).filter((id): id is string => id != null));

  let archivosStorage = 0;
  let archivosStorageConError = 0;
  if (ids.length > 0) {
    const docs = await db.comunicacionDocumento.findMany({
      where: { comunicacionId: { in: ids } },
      select: { storagePath: true },
    });
    const resultados = await Promise.allSettled(docs.map((d) => deleteDocumento(d.storagePath)));
    for (const r of resultados) {
      if (r.status === "fulfilled") archivosStorage++;
      else archivosStorageConError++;
    }
  }

  const { count: firmas } =
    ids.length > 0 ? await db.firma.deleteMany({ where: { comunicacionId: { in: ids } } }) : { count: 0 };

  const { count: comunicacionesBorradas } =
    ids.length > 0 ? await db.comunicacion.deleteMany({ where: { id: { in: ids } } }) : { count: 0 };

  let solicitantes = 0;
  if (tercerosCandidatos.size > 0) {
    const huerfanos = await db.solicitante.findMany({
      where: {
        id: { in: [...tercerosCandidatos] },
        comunicaciones: { none: {} },
        expedientes: { none: {} },
      },
      select: { id: true },
    });
    if (huerfanos.length > 0) {
      ({ count: solicitantes } = await db.solicitante.deleteMany({ where: { id: { in: huerfanos.map((s) => s.id) } } }));
    }
  }

  const { count: seriesConsecutivoReiniciadas } = await db.consecutivoRadicado.updateMany({
    where: { serie: { in: [...SERIES_CORRESPONDENCIA] } },
    data: { ultimoNumero: 0 },
  });

  return {
    comunicaciones: comunicacionesBorradas,
    firmas,
    archivosStorage,
    archivosStorageConError,
    solicitantes,
    seriesConsecutivoReiniciadas,
  };
}
