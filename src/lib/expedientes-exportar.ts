import ExcelJS from "exceljs";

export type FilaExportExpediente = {
  numero: string;
  tramiteCodigo: string;
  tramiteNombre: string;
  solicitanteNombre: string;
  solicitanteIdentificacion: string;
  municipio: string;
  estado: string;
  archivado: boolean;
  fechaRadicacion: Date;
  fechaUltimoMovimiento: Date;
};

const COLUMNAS: { header: string; key: keyof FilaExportExpediente; width: number }[] = [
  { header: "Número de expediente", key: "numero", width: 26 },
  { header: "Código de trámite", key: "tramiteCodigo", width: 16 },
  { header: "Trámite", key: "tramiteNombre", width: 42 },
  { header: "Solicitante", key: "solicitanteNombre", width: 32 },
  { header: "Identificación", key: "solicitanteIdentificacion", width: 16 },
  { header: "Municipio", key: "municipio", width: 16 },
  { header: "Estado", key: "estado", width: 24 },
  { header: "Cerrado y archivado", key: "archivado", width: 18 },
  { header: "Fecha de radicación", key: "fechaRadicacion", width: 18 },
  { header: "Último movimiento", key: "fechaUltimoMovimiento", width: 18 },
];

function formatearFechaCorta(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bogota" });
}

function formatearGeneradoEl(d: Date): string {
  return `${formatearFechaCorta(d)} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}`;
}

function valorColumna(f: FilaExportExpediente, key: keyof FilaExportExpediente): string {
  if (key === "fechaRadicacion" || key === "fechaUltimoMovimiento") return formatearFechaCorta(f[key] as Date);
  if (key === "estado") return String(f.estado).replaceAll("_", " ");
  if (key === "archivado") return f.archivado ? "Sí" : "No";
  return String(f[key] ?? "");
}

function csvCampo(v: string): string {
  return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function csvExpedientes(filas: FilaExportExpediente[], filtrosTexto: string): string {
  const lineas = [
    csvCampo("Trámites CDMB — Expedientes exportados"),
    csvCampo(`Generado el ${formatearGeneradoEl(new Date())}`),
    csvCampo(`Filtros: ${filtrosTexto || "ninguno (histórico completo)"}`),
    csvCampo(`Total de registros: ${filas.length}`),
    "",
    COLUMNAS.map((c) => csvCampo(c.header)).join(","),
    ...filas.map((f) => COLUMNAS.map((c) => csvCampo(valorColumna(f, c.key))).join(",")),
  ];
  return lineas.join("\n") + "\n";
}

export async function xlsxExpedientes(filas: FilaExportExpediente[], filtrosTexto: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trámites CDMB";
  wb.created = new Date();
  const ws = wb.addWorksheet("Expedientes");

  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = "Trámites CDMB — Expedientes exportados";
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A2").value = `Generado el ${formatearGeneradoEl(new Date())}`;
  ws.getCell("A3").value = `Filtros: ${filtrosTexto || "ninguno (histórico completo)"}`;
  ws.getCell("A4").value = `Total de registros: ${filas.length}`;
  for (const fila of [2, 3, 4]) ws.getCell(`A${fila}`).font = { italic: true, size: 10, color: { argb: "FF666666" } };

  ws.columns = COLUMNAS.map((c) => ({ key: c.key, width: c.width }));
  const filaEncabezado = ws.getRow(6);
  COLUMNAS.forEach((c, i) => {
    filaEncabezado.getCell(i + 1).value = c.header;
  });
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  });

  for (const f of filas) {
    const fila: Record<string, string> = {};
    for (const c of COLUMNAS) fila[c.key] = valorColumna(f, c.key);
    ws.addRow(fila);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
