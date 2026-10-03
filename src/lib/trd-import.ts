import Papa from "papaparse";
import { db } from "@/lib/db";
import type { DisposicionFinal } from "@prisma/client";

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
  disposicion_final?: string;
  reprografia?: string;
  numeroFila?: number;
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

const ALIAS_COLUMNAS: Record<string, (typeof COLUMNAS_TRD_CSV)[number]> = {
  codigo_dependencia: "dependencia_codigo",
  cod_dependencia: "dependencia_codigo",
  nombre_dependencia: "dependencia_nombre",
  dependencia: "dependencia_nombre",
  codigo_serie: "serie_codigo",
  cod_serie: "serie_codigo",
  nombre_serie: "serie_nombre",
  serie: "serie_nombre",
  descripcion_serie: "serie_descripcion",
  codigo_subserie: "subserie_codigo",
  cod_subserie: "subserie_codigo",
  nombre_subserie: "subserie_nombre",
  subserie: "subserie_nombre",
  retencion_archivo_gestion: "retencion_gestion",
  ag: "retencion_gestion",
  retencion_archivo_central: "retencion_central",
  ac: "retencion_central",
  ct: "disposicion_ct",
  conservacion_total: "disposicion_ct",
  e: "disposicion_e",
  eliminacion: "disposicion_e",
  md: "disposicion_md",
  m_d: "disposicion_md",
  s: "disposicion_s",
  seleccion: "disposicion_s",
  procedimientos: "procedimiento",
  tipos_documental: "tipos_documentales",
  tipo_documental: "tipos_documentales",
};

const ALIAS_EXTRA: Record<string, keyof FilaTrdCsv> = {
  oficina_productora: "dependencia_nombre",
  oficina: "dependencia_nombre",
  unidad_administrativa: "dependencia_nombre",
  tiempo_retencion_ag: "retencion_gestion",
  retencion_ag: "retencion_gestion",
  tiempo_retencion_ac: "retencion_central",
  retencion_ac: "retencion_central",
  disposicion_final: "disposicion_final",
  disposicion: "disposicion_final",
  procedimiento_de_reprografia: "reprografia",
  reprografia: "reprografia",
};

export function normalizarEncabezado(h: string): string {
  const base = h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s.\-/]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ALIAS_COLUMNAS[base] ?? ALIAS_EXTRA[base] ?? base;
}

export function parsearCsvTrd(contenido: string): { filas: FilaTrdCsv[]; errores: string[] } {
  const resultado = Papa.parse<FilaTrdCsv>(contenido.trim(), {
    header: true,
    delimitersToGuess: [";", ",", "\t", "|"],
    skipEmptyLines: true,
    transformHeader: normalizarEncabezado,
  });
  const errores = resultado.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .map((e) => `Fila ${(e.row ?? 0) + 2}: ${e.message}`);
  const columnas = resultado.meta.fields ?? [];
  const faltantes = COLUMNAS_OBLIGATORIAS.filter((c) => !columnas.includes(c));
  if (faltantes.length > 0) {
    errores.push(
      `Faltan columnas obligatorias en el archivo: ${faltantes.join(", ")}. ` +
        `Encabezados leídos: ${columnas.join(", ") || "(ninguno)"}.`
    );
  }
  return { filas: resultado.data, errores };
}

function escaparXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function desescaparXml(v: string): string {
  return v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function formatearXmlTrd(filas: Record<(typeof COLUMNAS_TRD_CSV)[number], string>[]): string {
  const cuerpo = filas
    .map((fila) => {
      const campos = COLUMNAS_TRD_CSV.map((c) => `    <${c}>${escaparXml(fila[c] ?? "")}</${c}>`).join("\n");
      return `  <Fila>\n${campos}\n  </Fila>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TRD>\n${cuerpo}\n</TRD>\n`;
}

export function parsearXmlTrd(contenido: string): { filas: FilaTrdCsv[]; errores: string[] } {
  const errores: string[] = [];
  const bloques = contenido.match(/<Fila>[\s\S]*?<\/Fila>/g) ?? [];
  if (bloques.length === 0) {
    errores.push('No se encontró ninguna etiqueta <Fila> — verifique que el archivo tenga el formato exportado por este mismo sistema.');
    return { filas: [], errores };
  }
  const filas: FilaTrdCsv[] = bloques.map((bloque) => {
    const fila = {} as FilaTrdCsv;
    for (const columna of COLUMNAS_TRD_CSV) {
      const m = new RegExp(`<${columna}>([\\s\\S]*?)<\\/${columna}>`).exec(bloque);
      fila[columna] = m ? desescaparXml(m[1]!) : "";
    }
    return fila;
  });
  const faltantes = COLUMNAS_OBLIGATORIAS.filter((c) => !contenido.includes(`<${c}>`));
  if (faltantes.length > 0) {
    errores.push(`Faltan columnas obligatorias en el XML: ${faltantes.join(", ")}.`);
  }
  return { filas, errores };
}

export type ResultadoImportacionTrd = {
  dependenciasCreadas: number;
  seriesCreadas: number;
  seriesActualizadas: number;
  seriesDesactivadas: number;
  subseriesCreadas: number;
  subseriesActualizadas: number;
  subseriesSinCambios: number;
  subseriesDesactivadas: number;
  subseriesEliminadas: number;
  subseriesReclasificadas: number;
  seriesEliminadas: number;
  tiposDocumentalesCreados: number;
  filasProcesadas: number;
  errores: string[];
};

const ORDEN_DISPOSICION: DisposicionFinal[] = ["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "MICROFILMACION_DIGITALIZACION"];

export function marcasADisposiciones(fila: FilaTrdCsv): DisposicionFinal[] {
  const d = new Set<DisposicionFinal>();
  if ((fila.disposicion_ct || "").trim()) d.add("CONSERVACION_TOTAL");
  if ((fila.disposicion_e || "").trim()) d.add("ELIMINACION");
  if ((fila.disposicion_md || "").trim()) d.add("MICROFILMACION_DIGITALIZACION");
  if ((fila.disposicion_s || "").trim()) d.add("SELECCION");
  const siglas = `${fila.disposicion_final ?? ""} ${fila.reprografia ?? ""}`
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  for (const sigla of siglas) {
    if (sigla === "CT") d.add("CONSERVACION_TOTAL");
    else if (sigla === "E") d.add("ELIMINACION");
    else if (sigla === "S") d.add("SELECCION");
    else if (sigla === "M" || sigla === "D" || sigla === "MD") d.add("MICROFILMACION_DIGITALIZACION");
  }
  return ORDEN_DISPOSICION.filter((x) => d.has(x));
}

function mismoConjunto(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

function aniosRetencion(valor: string | undefined): number {
  return Math.max(0, Math.floor(Number(valor) || 0));
}

export async function importarTrd(
  filas: FilaTrdCsv[],
  opciones: { modo: "vigente" | "historica"; version: string; sincronizar?: boolean; simular?: boolean }
): Promise<ResultadoImportacionTrd> {
  const resultado: ResultadoImportacionTrd = {
    dependenciasCreadas: 0,
    seriesCreadas: 0,
    seriesActualizadas: 0,
    seriesDesactivadas: 0,
    subseriesCreadas: 0,
    subseriesActualizadas: 0,
    subseriesSinCambios: 0,
    subseriesDesactivadas: 0,
    subseriesEliminadas: 0,
    subseriesReclasificadas: 0,
    seriesEliminadas: 0,
    tiposDocumentalesCreados: 0,
    filasProcesadas: 0,
    errores: [],
  };
  const version = opciones.version.trim() || `import-${new Date().toISOString().slice(0, 10)}`;
  const escribir = !opciones.simular;
  let contadorSimulado = 0;
  const idSimulado = () => `simulado-${++contadorSimulado}`;

  const dependencias = new Map(
    (await db.dependencia.findMany({ select: { id: true, codigo: true } })).map((d) => [d.codigo, d.id] as const)
  );
  const seriesExistentes = await db.serieDocumental.findMany({
    where: { version },
    select: {
      id: true,
      dependenciaId: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      activo: true,
      vigenteHasta: true,
      subseries: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          retencionGestionAnios: true,
          retencionCentralAnios: true,
          disposicionesFinal: true,
          procedimiento: true,
          activo: true,
        },
      },
    },
  });
  type SerieCargada = (typeof seriesExistentes)[number];
  const series = new Map<string, SerieCargada>(seriesExistentes.map((s) => [`${s.dependenciaId}:${s.codigo}`, s]));

  const nombreSeriePorClave = new Map<string, string>();
  const nombreSubseriePorClave = new Map<string, string>();
  const dependenciasTocadas = new Set<string>();
  const seriesRevisadas = new Set<string>();
  const subseriesTocadas = new Set<string>();

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const numFila = fila.numeroFila ?? i + 2;
    const depCodigo = (fila.dependencia_codigo || "").trim();
    const depNombre = (fila.dependencia_nombre || "").trim();
    const serieCodigo = (fila.serie_codigo || "").trim();
    const serieNombre = (fila.serie_nombre || "").trim();
    const serieDescripcion = (fila.serie_descripcion || "").trim() || null;
    let subserieCodigo = (fila.subserie_codigo || "").trim();
    let subserieNombre = (fila.subserie_nombre || "").trim();

    if (!depCodigo || !serieCodigo) {
      resultado.errores.push(`Fila ${numFila}: faltan el código de la dependencia o de la serie — se omitió.`);
      continue;
    }
    if (!subserieCodigo) {
      subserieCodigo = serieCodigo;
      subserieNombre = serieNombre || serieCodigo;
    }

    let dependenciaId = dependencias.get(depCodigo);
    if (!dependenciaId) {
      dependenciaId = escribir
        ? (await db.dependencia.create({ data: { codigo: depCodigo, nombre: depNombre || depCodigo, nivel: depCodigo.length > 3 ? 1 : 0 } })).id
        : idSimulado();
      dependencias.set(depCodigo, dependenciaId);
      resultado.dependenciasCreadas++;
    }
    dependenciasTocadas.add(dependenciaId);

    const claveSerie = `${dependenciaId}:${serieCodigo}`;
    if (serieNombre) {
      const nombreAnterior = nombreSeriePorClave.get(claveSerie);
      if (nombreAnterior && nombreAnterior !== serieNombre) {
        resultado.errores.push(
          `Fila ${numFila}: la serie "${serieCodigo}" ya apareció como "${nombreAnterior}" en una fila anterior de este mismo archivo; aquí trae "${serieNombre}" — revise si es un error de digitación (se guardó el primer nombre).`
        );
      } else {
        nombreSeriePorClave.set(claveSerie, serieNombre);
      }
    }

    let serie = series.get(claveSerie);
    if (!serie) {
      if (opciones.modo === "vigente" && escribir) {
        await db.serieDocumental.updateMany({
          where: { dependenciaId, codigo: serieCodigo, vigenteHasta: null },
          data: { vigenteHasta: new Date() },
        });
      }
      const datosSerie = {
        codigo: serieCodigo,
        nombre: serieNombre || serieCodigo,
        descripcion: serieDescripcion,
        dependenciaId,
        version,
        vigenteHasta: opciones.modo === "historica" ? new Date() : null,
      };
      const id = escribir ? (await db.serieDocumental.create({ data: datosSerie })).id : idSimulado();
      serie = { ...datosSerie, id, activo: true, subseries: [] };
      series.set(claveSerie, serie);
      seriesRevisadas.add(serie.id);
      resultado.seriesCreadas++;
    } else if (!seriesRevisadas.has(serie.id)) {
      seriesRevisadas.add(serie.id);
      const cambios: { nombre?: string; descripcion?: string; activo?: boolean } = {};
      if (serieNombre && serieNombre !== serie.nombre) cambios.nombre = serieNombre;
      if (serieDescripcion && serieDescripcion !== serie.descripcion) cambios.descripcion = serieDescripcion;
      if (opciones.sincronizar && !serie.activo) cambios.activo = true;
      if (Object.keys(cambios).length > 0) {
        if (escribir) await db.serieDocumental.update({ where: { id: serie.id }, data: cambios });
        Object.assign(serie, cambios);
        resultado.seriesActualizadas++;
      }
    }

    const claveSubserie = `${serie.id}:${subserieCodigo}`;
    if (subserieNombre) {
      const nombreAnterior = nombreSubseriePorClave.get(claveSubserie);
      if (nombreAnterior && nombreAnterior !== subserieNombre) {
        resultado.errores.push(
          `Fila ${numFila}: la subserie "${subserieCodigo}" de "${serieCodigo}" ya apareció como "${nombreAnterior}" en una fila anterior; aquí trae "${subserieNombre}" — revise si es un error de digitación (se guardó este último nombre).`
        );
      }
      nombreSubseriePorClave.set(claveSubserie, subserieNombre);
    }

    const disposicionesFinal = marcasADisposiciones(fila);
    const retencionGestionAnios = aniosRetencion(fila.retencion_gestion);
    const retencionCentralAnios = aniosRetencion(fila.retencion_central);
    const procedimiento = (fila.procedimiento || "").trim() || null;

    const existente = serie.subseries.find((s) => s.codigo === subserieCodigo);
    let subserieId: string;
    if (existente) {
      const cambios: {
        nombre?: string;
        retencionGestionAnios?: number;
        retencionCentralAnios?: number;
        disposicionesFinal?: DisposicionFinal[];
        procedimiento?: string;
        activo?: boolean;
      } = {};
      if (subserieNombre && subserieNombre !== existente.nombre) cambios.nombre = subserieNombre;
      if (retencionGestionAnios !== existente.retencionGestionAnios) cambios.retencionGestionAnios = retencionGestionAnios;
      if (retencionCentralAnios !== existente.retencionCentralAnios) cambios.retencionCentralAnios = retencionCentralAnios;
      if (!mismoConjunto(disposicionesFinal, existente.disposicionesFinal)) cambios.disposicionesFinal = disposicionesFinal;
      if (procedimiento && procedimiento !== existente.procedimiento) cambios.procedimiento = procedimiento;
      if (opciones.sincronizar && !existente.activo) cambios.activo = true;
      if (Object.keys(cambios).length > 0) {
        if (escribir) await db.subserieDocumental.update({ where: { id: existente.id }, data: cambios });
        Object.assign(existente, cambios);
        resultado.subseriesActualizadas++;
      } else {
        resultado.subseriesSinCambios++;
      }
      subserieId = existente.id;
    } else {
      const datosSubserie = {
        serieId: serie.id,
        codigo: subserieCodigo,
        nombre: subserieNombre || subserieCodigo,
        retencionGestionAnios,
        retencionCentralAnios,
        disposicionesFinal,
        procedimiento,
      };
      subserieId = escribir ? (await db.subserieDocumental.create({ data: datosSubserie })).id : idSimulado();
      serie.subseries.push({ ...datosSubserie, id: subserieId, activo: true });
      resultado.subseriesCreadas++;
    }
    subseriesTocadas.add(subserieId);

    const tiposTexto = (fila.tipos_documentales || "").trim();
    if (tiposTexto) {
      const nombres = tiposTexto
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean);
      if (escribir) {
        await db.tipoDocumental.deleteMany({ where: { subserieId } });
        if (nombres.length > 0) await db.tipoDocumental.createMany({ data: nombres.map((nombre) => ({ subserieId, nombre })) });
      }
      resultado.tiposDocumentalesCreados += nombres.length;
    }

    resultado.filasProcesadas++;
  }

  if (opciones.sincronizar) {
    for (const serie of series.values()) {
      if (!serie.dependenciaId || !dependenciasTocadas.has(serie.dependenciaId) || serie.vigenteHasta) continue;
      const enArchivo = serie.subseries.filter((s) => subseriesTocadas.has(s.id));
      const reemplazo = enArchivo.length === 1 ? enArchivo[0]! : null;
      let quedanSubseries = enArchivo.length;
      for (const sub of serie.subseries) {
        if (subseriesTocadas.has(sub.id)) continue;
        const usos = await usosSubserie(sub.id);
        if (usos.total > 0 && !reemplazo) {
          quedanSubseries++;
          if (sub.activo) {
            if (escribir) await db.subserieDocumental.update({ where: { id: sub.id }, data: { activo: false } });
            sub.activo = false;
            resultado.subseriesDesactivadas++;
          }
          resultado.errores.push(
            `La subserie ${sub.codigo} "${sub.nombre}" no viene en el archivo pero tiene ${usos.total} registro(s) clasificados y su serie no tiene una única subserie de reemplazo: se dejó inactiva. Reclasifique esos registros y vuelva a cargar el archivo para eliminarla.`
          );
          continue;
        }
        if (escribir) {
          if (usos.total > 0 && reemplazo) await moverClasificacion(sub.id, reemplazo.id);
          await db.subserieDocumental.delete({ where: { id: sub.id } });
        }
        if (usos.total > 0) resultado.subseriesReclasificadas++;
        resultado.subseriesEliminadas++;
      }
      if (quedanSubseries === 0) {
        const usosSerie = await usosSerieDocumental(serie.id);
        if (usosSerie > 0) {
          if (serie.activo) {
            if (escribir) await db.serieDocumental.update({ where: { id: serie.id }, data: { activo: false } });
            serie.activo = false;
            resultado.seriesDesactivadas++;
          }
          resultado.errores.push(
            `La serie ${serie.codigo} "${serie.nombre}" no viene en el archivo pero tiene ${usosSerie} registro(s) clasificados: se dejó inactiva.`
          );
        } else {
          if (escribir) await db.serieDocumental.delete({ where: { id: serie.id } });
          resultado.seriesEliminadas++;
        }
      }
    }
  }

  return resultado;
}

async function usosSubserie(subserieId: string): Promise<{ total: number }> {
  const tipo = { tipoDocumental: { subserieId } };
  const conteos = await Promise.all([
    db.comunicacion.count({ where: { subserieId } }),
    db.expedienteDocumental.count({ where: { subserieId } }),
    db.tramiteTipo.count({ where: { subserieId } }),
    db.configuracionSitio.count({ where: { subserieContratacionId: subserieId } }),
    db.expedienteContractual.count({ where: { subserieId } }),
    db.trdModalidadContratacion.count({ where: { subserieId } }),
    db.documentoArchivo.count({ where: tipo }),
    db.documentoRequeridoDefinicion.count({ where: tipo }),
    db.expedienteDocumento.count({ where: tipo }),
    db.requisitoDocumentoContratacion.count({ where: tipo }),
    db.documentoContrato.count({ where: tipo }),
  ]);
  return { total: conteos.reduce((a, b) => a + b, 0) };
}

async function usosSerieDocumental(serieId: string): Promise<number> {
  const conteos = await Promise.all([
    db.comunicacion.count({ where: { serieId } }),
    db.expedienteDocumental.count({ where: { serieId } }),
    db.campoMetadato.count({ where: { serieId } }),
  ]);
  return conteos.reduce((a, b) => a + b, 0);
}

async function moverClasificacion(desdeId: string, haciaId: string): Promise<void> {
  const tipo = { tipoDocumental: { subserieId: desdeId } };
  await db.$transaction([
    db.comunicacion.updateMany({ where: { subserieId: desdeId }, data: { subserieId: haciaId } }),
    db.expedienteDocumental.updateMany({ where: { subserieId: desdeId }, data: { subserieId: haciaId } }),
    db.tramiteTipo.updateMany({ where: { subserieId: desdeId }, data: { subserieId: haciaId } }),
    db.configuracionSitio.updateMany({ where: { subserieContratacionId: desdeId }, data: { subserieContratacionId: haciaId } }),
    db.expedienteContractual.updateMany({ where: { subserieId: desdeId }, data: { subserieId: haciaId } }),
    db.trdModalidadContratacion.updateMany({ where: { subserieId: desdeId }, data: { subserieId: haciaId } }),
    db.documentoArchivo.updateMany({ where: tipo, data: { tipoDocumentalId: null } }),
    db.documentoRequeridoDefinicion.updateMany({ where: tipo, data: { tipoDocumentalId: null } }),
    db.expedienteDocumento.updateMany({ where: tipo, data: { tipoDocumentalId: null } }),
    db.requisitoDocumentoContratacion.updateMany({ where: tipo, data: { tipoDocumentalId: null } }),
    db.documentoContrato.updateMany({ where: tipo, data: { tipoDocumentalId: null } }),
  ]);
}
