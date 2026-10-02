import ExcelJS from "exceljs";
import { normalizarEncabezado, type FilaTrdCsv } from "@/lib/trd-import";

const CODIGO_DE: Record<string, keyof FilaTrdCsv> = {
  dependencia_nombre: "dependencia_codigo",
  serie_nombre: "serie_codigo",
  subserie_nombre: "subserie_codigo",
};

function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") {
    if ("richText" in valor) return valor.richText.map((t) => t.text).join("");
    if ("result" in valor) return valor.result === undefined || valor.result === null ? "" : String(valor.result);
    if ("text" in valor) return String(valor.text);
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return "";
  }
  return String(valor);
}

export function mapearEncabezados(encabezados: string[]): (keyof FilaTrdCsv | null)[] {
  const base = encabezados.map((h) => (h.trim() ? normalizarEncabezado(h) : ""));
  return base.map((h, i) => {
    if (h === "codigo" || h === "cod") {
      const siguiente = base[i + 1] ?? "";
      return CODIGO_DE[siguiente] ?? null;
    }
    return h ? (h as keyof FilaTrdCsv) : null;
  });
}

export function filasDesdeMatriz(matriz: string[][]): { filas: FilaTrdCsv[]; errores: string[] } {
  const errores: string[] = [];
  const indiceEncabezado = matriz.slice(0, 15).findIndex((fila) => {
    const columnas = mapearEncabezados(fila);
    return columnas.includes("serie_codigo") && columnas.includes("dependencia_codigo");
  });
  if (indiceEncabezado < 0) {
    errores.push(
      "No se encontró la fila de encabezados: se esperaban columnas de código y nombre de dependencia (u oficina productora), serie y subserie."
    );
    return { filas: [], errores };
  }
  const columnas = mapearEncabezados(matriz[indiceEncabezado]!);
  const filas: FilaTrdCsv[] = [];
  for (let r = indiceEncabezado + 1; r < matriz.length; r++) {
    const celdas = matriz[r]!;
    const fila = { numeroFila: r + 1 } as FilaTrdCsv;
    columnas.forEach((columna, i) => {
      if (columna && columna !== "numeroFila") (fila as Record<string, unknown>)[columna] = (celdas[i] ?? "").replace(/\s+/g, " ").trim();
    });
    if (!fila.dependencia_codigo && !fila.serie_codigo) continue;
    const serie = fila.serie_codigo ?? "";
    const sub = fila.subserie_codigo ?? "";
    if (serie && sub && !sub.includes(".") && sub !== serie) fila.subserie_codigo = `${serie}.${sub}`;
    filas.push(fila);
  }
  return { filas, errores };
}

export async function parsearXlsxTrd(contenido: ArrayBuffer): Promise<{ filas: FilaTrdCsv[]; errores: string[] }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(contenido);
  } catch {
    return { filas: [], errores: ["El archivo no es un Excel (.xlsx) válido."] };
  }
  const hoja = libro.worksheets[0];
  if (!hoja) return { filas: [], errores: ["El libro de Excel no tiene hojas."] };
  const matriz: string[][] = [];
  for (let r = 1; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const celdas: string[] = [];
    for (let c = 1; c <= Math.max(hoja.columnCount, fila.cellCount); c++) celdas.push(textoCelda(fila.getCell(c).value));
    matriz.push(celdas);
  }
  return filasDesdeMatriz(matriz);
}
