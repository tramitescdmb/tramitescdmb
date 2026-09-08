import Papa from "papaparse";
import { db } from "@/lib/db";
import type { DisposicionFinal } from "@prisma/client";

/**
 * Importación de TRD desde CSV (Acuerdo 004/2019 AGN — el SGDEA debe permitir
 * cargar/versionar la TRD desde archivos planos, MoReq req. 1.1/1.7). El mismo
 * formato sirve para dos casos:
 *  - TRD VIGENTE: pasa a ser la versión activa de cada serie que toque; la
 *    versión anterior de esa serie (si existía) se cierra (vigenteHasta=ahora),
 *    NUNCA se borra — así queda disponible para lo que ya se clasificó con ella.
 *  - TRD HISTÓRICA: se carga ya cerrada desde el principio (vigenteHasta=ahora
 *    de una vez), solo para poder reclasificar/migrar información antigua sin
 *    afectar en nada la TRD vigente actual.
 */

export type FilaTrdCsv = {
  dependencia_codigo: string;
  dependencia_nombre: string;
  serie_codigo: string;
  serie_nombre: string;
  serie_descripcion: string;
  subserie_codigo: string;
  subserie_nombre: string;
  retencion_gestion: string;
  retencion_central: string;
  disposicion_ct: string;
  disposicion_e: string;
  disposicion_md: string;
  disposicion_s: string;
  procedimiento: string;
  tipos_documentales: string;
};

export const COLUMNAS_TRD_CSV = [
  "dependencia_codigo",
  "dependencia_nombre",
  "serie_codigo",
  "serie_nombre",
  "serie_descripcion",
  "subserie_codigo",
  "subserie_nombre",
  "retencion_gestion",
  "retencion_central",
  "disposicion_ct",
  "disposicion_e",
  "disposicion_md",
  "disposicion_s",
  "procedimiento",
  "tipos_documentales",
] as const;

const COLUMNAS_OBLIGATORIAS = ["dependencia_codigo", "serie_codigo", "subserie_codigo"];

export function parsearCsvTrd(contenido: string): { filas: FilaTrdCsv[]; errores: string[] } {
  const resultado = Papa.parse<FilaTrdCsv>(contenido.trim(), { header: true, delimiter: ";", skipEmptyLines: true });
  const errores = resultado.errors.map((e) => `Fila ${(e.row ?? 0) + 2}: ${e.message}`);
  const columnas = resultado.meta.fields ?? [];
  const faltantes = COLUMNAS_OBLIGATORIAS.filter((c) => !columnas.includes(c));
  if (faltantes.length > 0) {
    errores.push(`Faltan columnas obligatorias en el CSV: ${faltantes.join(", ")}.`);
  }
  return { filas: resultado.data, errores };
}

export type ResultadoImportacionTrd = {
  dependenciasCreadas: number;
  seriesCreadas: number;
  subseriesCreadas: number;
  subseriesActualizadas: number;
  tiposDocumentalesCreados: number;
  filasProcesadas: number;
  errores: string[];
};

function marcasADisposiciones(fila: FilaTrdCsv): DisposicionFinal[] {
  const d: DisposicionFinal[] = [];
  if ((fila.disposicion_ct || "").trim()) d.push("CONSERVACION_TOTAL");
  if ((fila.disposicion_e || "").trim()) d.push("ELIMINACION");
  if ((fila.disposicion_md || "").trim()) d.push("MICROFILMACION_DIGITALIZACION");
  if ((fila.disposicion_s || "").trim()) d.push("SELECCION");
  return d;
}

export async function importarTrd(
  filas: FilaTrdCsv[],
  opciones: { modo: "vigente" | "historica"; version: string }
): Promise<ResultadoImportacionTrd> {
  const resultado: ResultadoImportacionTrd = {
    dependenciasCreadas: 0,
    seriesCreadas: 0,
    subseriesCreadas: 0,
    subseriesActualizadas: 0,
    tiposDocumentalesCreados: 0,
    filasProcesadas: 0,
    errores: [],
  };
  const version = opciones.version.trim() || `import-${new Date().toISOString().slice(0, 10)}`;

  // Sin transacción envolvente a propósito: son cientos de filas, cada una
  // idempotente por sí sola (busca-o-crea) — envolverlas todas en una sola
  // transacción larga agota el límite de tiempo de la conexión con Supabase.
  // Si la importación se corta a la mitad, repetirla es seguro: retoma donde
  // quedó sin duplicar nada.
  await (async (tx: typeof db) => {
      const dependenciaPorCodigo = new Map<string, string>();
      const seriePorClave = new Map<string, string>(); // `${depId}:${serieCodigo}` -> serieId

      for (let i = 0; i < filas.length; i++) {
        const fila = filas[i]!;
        const numFila = i + 2;
        const depCodigo = (fila.dependencia_codigo || "").trim();
        const depNombre = (fila.dependencia_nombre || "").trim();
        const serieCodigo = (fila.serie_codigo || "").trim();
        const serieNombre = (fila.serie_nombre || "").trim();
        const serieDescripcion = (fila.serie_descripcion || "").trim() || null;
        const subserieCodigo = (fila.subserie_codigo || "").trim();
        const subserieNombre = (fila.subserie_nombre || "").trim();

        if (!depCodigo || !serieCodigo || !subserieCodigo) {
          resultado.errores.push(`Fila ${numFila}: faltan código de dependencia, serie o subserie — se omitió.`);
          continue;
        }

        let dependenciaId = dependenciaPorCodigo.get(depCodigo);
        if (!dependenciaId) {
          const existente = await tx.dependencia.findUnique({ where: { codigo: depCodigo }, select: { id: true } });
          if (existente) {
            dependenciaId = existente.id;
          } else {
            const nueva = await tx.dependencia.create({
              data: { codigo: depCodigo, nombre: depNombre || depCodigo, nivel: depCodigo.length > 3 ? 1 : 0 },
            });
            dependenciaId = nueva.id;
            resultado.dependenciasCreadas++;
          }
          dependenciaPorCodigo.set(depCodigo, dependenciaId);
        }

        const claveSerie = `${dependenciaId}:${serieCodigo}`;
        let serieId = seriePorClave.get(claveSerie);
        if (!serieId) {
          const existente = await tx.serieDocumental.findFirst({
            where: { dependenciaId, codigo: serieCodigo, version },
            select: { id: true },
          });
          if (existente) {
            serieId = existente.id;
            await tx.serieDocumental.update({
              where: { id: existente.id },
              data: { nombre: serieNombre || serieCodigo, descripcion: serieDescripcion },
            });
          } else {
            if (opciones.modo === "vigente") {
              // Cierra la version anterior de ESTA serie en ESTA dependencia (nunca la borra).
              await tx.serieDocumental.updateMany({
                where: { dependenciaId, codigo: serieCodigo, vigenteHasta: null },
                data: { vigenteHasta: new Date() },
              });
            }
            const nuevaSerie = await tx.serieDocumental.create({
              data: {
                codigo: serieCodigo,
                nombre: serieNombre || serieCodigo,
                descripcion: serieDescripcion,
                dependenciaId,
                version,
                vigenteHasta: opciones.modo === "historica" ? new Date() : null,
              },
            });
            serieId = nuevaSerie.id;
            resultado.seriesCreadas++;
          }
          seriePorClave.set(claveSerie, serieId);
        }

        const disposicionesFinal = marcasADisposiciones(fila);
        const retencionGestionAnios = Math.max(0, Math.floor(Number(fila.retencion_gestion) || 0));
        const retencionCentralAnios = Math.max(0, Math.floor(Number(fila.retencion_central) || 0));
        const procedimiento = (fila.procedimiento || "").trim() || null;

        const subserieExistente = await tx.subserieDocumental.findFirst({
          where: { serieId, codigo: subserieCodigo },
          select: { id: true },
        });
        let subserieId: string;
        if (subserieExistente) {
          await tx.subserieDocumental.update({
            where: { id: subserieExistente.id },
            data: { nombre: subserieNombre || subserieCodigo, retencionGestionAnios, retencionCentralAnios, disposicionesFinal, procedimiento },
          });
          subserieId = subserieExistente.id;
          resultado.subseriesActualizadas++;
        } else {
          const nuevaSubserie = await tx.subserieDocumental.create({
            data: {
              serieId,
              codigo: subserieCodigo,
              nombre: subserieNombre || subserieCodigo,
              retencionGestionAnios,
              retencionCentralAnios,
              disposicionesFinal,
              procedimiento,
            },
          });
          subserieId = nuevaSubserie.id;
          resultado.subseriesCreadas++;
        }

        const tiposTexto = (fila.tipos_documentales || "").trim();
        if (tiposTexto) {
          await tx.tipoDocumental.deleteMany({ where: { subserieId } });
          const nombres = tiposTexto
            .split("|")
            .map((t) => t.trim())
            .filter(Boolean);
          if (nombres.length > 0) {
            await tx.tipoDocumental.createMany({ data: nombres.map((nombre) => ({ subserieId, nombre })) });
            resultado.tiposDocumentalesCreados += nombres.length;
          }
        }

        resultado.filasProcesadas++;
      }
  })(db);

  return resultado;
}
