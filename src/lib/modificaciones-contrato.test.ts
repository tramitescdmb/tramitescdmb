import { describe, expect, it } from "vitest";
import { errorModificacion, esDocumentoModificacion, leerModificacion } from "@/lib/modificaciones-contrato";

describe("modificaciones del contrato", () => {
  it("reconoce los documentos de modificación", () => {
    expect(esDocumentoModificacion("Acta de concertación de prórroga del plazo")).toBe(true);
    expect(esDocumentoModificacion("Acta de concertación — adición en valor y/o prórroga del plazo")).toBe(true);
    expect(esDocumentoModificacion("Otrosí N.° 1")).toBe(true);
    expect(esDocumentoModificacion("Informe de supervisión")).toBe(false);
    expect(esDocumentoModificacion("Información adicional")).toBe(false);
    expect(esDocumentoModificacion("Certificado de Disponibilidad Presupuestal de la adición")).toBe(false);
  });

  it("exige fecha posterior en prórroga y valor en adición", () => {
    const fin = new Date("2026-12-21T00:00:00Z");
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA" })!, fin)).toMatch(/nueva fecha/);
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2026-12-01" })!, fin)).toMatch(/posterior/);
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31" })!, fin)).toBeNull();
    expect(errorModificacion(leerModificacion({ tipo: "ADICION_VALOR" })!, fin)).toMatch(/valor/);
    expect(errorModificacion(leerModificacion({ tipo: "ADICION_VALOR", valorAdicionado: 5000000 })!, fin)).toBeNull();
    expect(leerModificacion({ tipo: "ADICION_VALOR", fechaTerminacion: "2027-01-31", valorAdicionado: 1 })!.fechaTerminacion).toBeNull();
  });
});
