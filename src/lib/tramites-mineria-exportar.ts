// Exportación de la tabla dinámica del módulo de minería de trámites (/mineria) — servidor únicamente.
import ExcelJS from "exceljs";
import type { FilaDimension } from "@/lib/tramites-mineria";

function formatearGeneradoEl(d: Date): string {
  return `${d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bogota" })} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}`;
}

export async function xlsxTablaDinamica(filas: FilaDimension[], columnaDimension: string, filtrosTexto: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trámites CDMB";
  wb.created = new Date();
  const ws = wb.addWorksheet("Minería de trámites");

  ws.mergeCells("A1:C1");
  ws.getCell("A1").value = "Trámites CDMB — Minería de datos, tabla dinámica";
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A2").value = `Generado el ${formatearGeneradoEl(new Date())}`;
  ws.getCell("A3").value = `Agrupado por: ${columnaDimension}. Filtros: ${filtrosTexto || "ninguno (histórico completo)"}`;
  ws.getCell("A4").value = `Total de registros: ${filas.reduce((s, f) => s + f.total, 0)}`;
  for (const fila of [2, 3, 4]) ws.getCell(`A${fila}`).font = { italic: true, size: 10, color: { argb: "FF666666" } };

  ws.columns = [
    { key: "label", width: 42 },
    { key: "total", width: 16 },
  ];
  const filaEncabezado = ws.getRow(6);
  filaEncabezado.getCell(1).value = columnaDimension;
  filaEncabezado.getCell(2).value = "Cantidad";
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  });

  for (const f of filas) ws.addRow({ label: f.label, total: f.total });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
