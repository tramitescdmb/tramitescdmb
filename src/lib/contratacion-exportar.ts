import ExcelJS from "exceljs";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";

export type FilaExportContrato = {
  codigoProceso: string | null;
  numero: string;
  numeroProcesoSecop: string | null;
  numeroContrato: string | null;
  objeto: string;
  modalidad: string;
  tipoContrato: string;
  dependencia: string;
  contratista: string | null;
  identificacionContratista: string | null;
  supervisor: string | null;
  valor: number | null;
  etapa: string;
  documentos: number;
  fechaSuscripcion: Date | null;
  fechaInicio: Date | null;
  fechaTerminacion: Date | null;
};

type Columna = { header: string; key: keyof FilaExportContrato; width: number };

const COLUMNAS: Columna[] = [
  { header: "Código de proceso", key: "codigoProceso", width: 20 },
  { header: "Expediente", key: "numero", width: 24 },
  { header: "N.º proceso SECOP", key: "numeroProcesoSecop", width: 22 },
  { header: "N.º contrato", key: "numeroContrato", width: 16 },
  { header: "Objeto", key: "objeto", width: 60 },
  { header: "Modalidad", key: "modalidad", width: 30 },
  { header: "Tipo de contrato", key: "tipoContrato", width: 24 },
  { header: "Dependencia", key: "dependencia", width: 34 },
  { header: "Contratista", key: "contratista", width: 34 },
  { header: "Identificación del contratista", key: "identificacionContratista", width: 18 },
  { header: "Supervisor", key: "supervisor", width: 34 },
  { header: "Valor", key: "valor", width: 16 },
  { header: "Etapa", key: "etapa", width: 20 },
  { header: "Documentos", key: "documentos", width: 12 },
  { header: "Suscripción", key: "fechaSuscripcion", width: 14 },
  { header: "Inicio", key: "fechaInicio", width: 14 },
  { header: "Terminación", key: "fechaTerminacion", width: 14 },
];

const TITULO = "GECON — Expedientes contractuales exportados";

function valorColumna(f: FilaExportContrato, key: keyof FilaExportContrato): string | number {
  const v = f[key];
  if (v instanceof Date) return formatearFecha(v);
  if (key === "valor") return v === null ? "" : (v as number);
  if (key === "documentos") return v as number;
  return v === null || v === undefined ? "" : String(v);
}

function csvCampo(v: string | number): string {
  const s = String(v);
  return /[,"\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function encabezado(filtrosTexto: string, total: number): string[] {
  return [`Generado el ${formatearFechaHora(new Date())}`, `Filtros: ${filtrosTexto || "ninguno"}`, `Total de registros: ${total}`];
}

export function csvContratos(filas: FilaExportContrato[], filtrosTexto: string): string {
  const lineas = [
    csvCampo(TITULO),
    ...encabezado(filtrosTexto, filas.length).map(csvCampo),
    "",
    COLUMNAS.map((c) => csvCampo(c.header)).join(","),
    ...filas.map((f) => COLUMNAS.map((c) => csvCampo(valorColumna(f, c.key))).join(",")),
  ];
  return "﻿" + lineas.join("\n") + "\n";
}

export async function xlsxContratos(filas: FilaExportContrato[], filtrosTexto: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GECON — CDMB";
  wb.created = new Date();
  const ws = wb.addWorksheet("Expedientes contractuales");

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = TITULO;
  ws.getCell("A1").font = { bold: true, size: 13 };
  encabezado(filtrosTexto, filas.length).forEach((texto, i) => {
    const celda = ws.getCell(`A${i + 2}`);
    celda.value = texto;
    celda.font = { italic: true, size: 10, color: { argb: "FF666666" } };
  });

  ws.columns = COLUMNAS.map((c) => ({ key: c.key, width: c.width }));
  const filaEncabezado = ws.getRow(6);
  COLUMNAS.forEach((c, i) => {
    filaEncabezado.getCell(i + 1).value = c.header;
  });
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF038F67" } };
  });

  for (const f of filas) {
    const fila: Record<string, string | number> = {};
    for (const c of COLUMNAS) fila[c.key] = valorColumna(f, c.key);
    ws.addRow(fila);
  }
  ws.getColumn("valor").numFmt = '"$"#,##0';
  ws.getColumn("objeto").alignment = { wrapText: true, vertical: "top" };
  ws.views = [{ state: "frozen", ySplit: 6 }];
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: COLUMNAS.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
