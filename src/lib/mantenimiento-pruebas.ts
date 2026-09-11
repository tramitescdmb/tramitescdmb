import { db } from "@/lib/db";
import { deleteDocumento } from "@/lib/storage";

/**
 * Herramienta TEMPORAL de mantenimiento — solo para la etapa de pruebas del
 * SGDEA, antes del lanzamiento a producción real. Mientras no se lance, TODA
 * la correspondencia radicada en el sistema es de prueba (así se acordó con
 * el usuario el 2026-09-11): este botón la borra por completo y reinicia el
 * consecutivo de radicación, para poder seguir probando con radicados
 * limpios desde el 000001 tantas veces como haga falta.
 *
 * Después de lanzar, un radicado es INALTERABLE (Ley 594/2000): esta función,
 * el endpoint que la expone (`/api/correspondencia/admin/reset-pruebas`) y el
 * botón en `/correspondencia/admin` deben borrarse por completo antes de esa
 * fecha — no dejarlos "por si acaso".
 *
 * Deliberadamente NO toca:
 * - `AuditoriaDoc`: es una cadena de hash por secuencia (no por entidad).
 *   Borrar filas del medio rompe `verificarCadena()` para siempre, incluso
 *   siendo de prueba — se deja huérfana, igual que ya quedaron ~43 radicados
 *   de pruebas anteriores. Ver [[feedback_limpieza_datos_prueba_auditoria]].
 * - `ExpedienteDocumental` / consecutivo de la serie "X": es el archivo
 *   general de la entidad, ya tiene contenido real (no nace de Comunicacion).
 * - `Usuario`: los de prueba ya se desactivan aparte, nunca se borran.
 */
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

  // 1. Borrar del Storage los archivos adjuntos antes de que la cascada borre sus filas.
  let archivosStorage = 0;
  let archivosStorageConError = 0;
  if (ids.length > 0) {
    const docs = await db.comunicacionDocumento.findMany({
      where: { comunicacionId: { in: ids } },
      select: { storagePath: true },
    });
    const resultados = await Promise.allSettled(docs.map((d) => deleteDocumento(d.storagePath)));
    for (const r of resultados) (r.status === "fulfilled" ? archivosStorage++ : archivosStorageConError++);
  }

  // 2. Firma no tiene cascada hacia Comunicacion -> borrar a mano antes.
  const { count: firmas } =
    ids.length > 0 ? await db.firma.deleteMany({ where: { comunicacionId: { in: ids } } }) : { count: 0 };

  // 3. Borrar las comunicaciones (cascada: ComunicacionDocumento, Distribucion, InstanciaFlujo).
  const { count: comunicacionesBorradas } =
    ids.length > 0 ? await db.comunicacion.deleteMany({ where: { id: { in: ids } } }) : { count: 0 };

  // 4. Solicitantes que quedaron sin ningún uso real (ni otra comunicación, ni un expediente
  //    de Trámites 2.0) — así nunca se toca a alguien con historial fuera del SGDEA de pruebas.
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

  // 5. Reiniciar a 0 el consecutivo de las series de correspondencia (todos los años que existan).
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
