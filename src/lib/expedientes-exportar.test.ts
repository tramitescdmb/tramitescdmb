import { describe, expect, it } from "vitest";
import { csvExpedientes, xlsxExpedientes, type FilaExportExpediente } from "./expedientes-exportar";

const fila: FilaExportExpediente = {
  numero: "M-DA-PR39-2026-0001",
  tramiteCodigo: "M-DA-PR39",
  tramiteNombre: "Permiso de Ocupación de Cauces, Playas y Lechos",
  solicitanteNombre: "Luis Lozano",
  solicitanteIdentificacion: "12345678",
  municipio: "Bucaramanga",
  estado: "EN_TRAMITE",
  fechaRadicacion: new Date("2026-01-15T00:00:00.000Z"),
  fechaUltimoMovimiento: new Date("2026-02-01T00:00:00.000Z"),
};

describe("csvExpedientes", () => {
  it("incluye el encabezado de fuente, la fecha de generación, los filtros y el total antes de las columnas", () => {
    const csv = csvExpedientes([fila], "estado \"EN TRAMITE\"; municipio Bucaramanga");
    const lineas = csv.trim().split("\n");
    expect(lineas[0]).toContain("Trámites CDMB");
    expect(lineas[1]).toContain("Generado el");
    expect(lineas[2]).toContain('Filtros: estado ""EN TRAMITE""; municipio Bucaramanga');
    expect(lineas[3]).toBe("Total de registros: 1");
    expect(lineas[5]).toBe("Número de expediente,Código de trámite,Trámite,Solicitante,Identificación,Municipio,Estado,Fecha de radicación,Último movimiento");
  });

  it("entrecomilla el nombre del trámite (trae coma) y normaliza el estado con espacios", () => {
    const csv = csvExpedientes([fila], "");
    const filaDatos = csv.trim().split("\n")[6];
    expect(filaDatos).toContain('"Permiso de Ocupación de Cauces, Playas y Lechos"');
    expect(filaDatos).toContain("EN TRAMITE");
  });

  it("sin filtros, deja explícito que es el histórico completo", () => {
    const csv = csvExpedientes([], "");
    expect(csv).toContain("ninguno (histórico completo)");
    expect(csv).toContain("Total de registros: 0");
  });
});

describe("xlsxExpedientes", () => {
  it("produce un buffer de un archivo .xlsx válido (firma ZIP)", async () => {
    const buffer = await xlsxExpedientes([fila], "vigencia 2026");
    // Un .xlsx es un ZIP — empieza con la firma "PK".
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
