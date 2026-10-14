import { describe, expect, it } from "vitest";
import { errorModificacion, esDocumentoModificacion, leerModificacion, soportesRequeridos } from "@/lib/modificaciones-contrato";

const hoy = new Date("2026-10-13T00:00:00Z");
const mod = (v: Record<string, unknown>) => leerModificacion({ fecha: "2026-10-01", ...v })!;

describe("modificaciones del contrato como registro documental", () => {
  it("reconoce las actas de modificación del catálogo", () => {
    expect(esDocumentoModificacion("Acta de concertación de prórroga del plazo")).toBe(true);
    expect(esDocumentoModificacion("Acta de concertación — adición de plazo y/o valor")).toBe(true);
    expect(esDocumentoModificacion("Acta de suspensión y reinicio")).toBe(true);
    expect(esDocumentoModificacion("Autorización de cesión del contrato")).toBe(true);
    expect(esDocumentoModificacion("Informe de supervisión")).toBe(false);
    expect(esDocumentoModificacion("Información adicional")).toBe(false);
    expect(esDocumentoModificacion("Certificado de Disponibilidad Presupuestal de la adición")).toBe(false);
  });

  it("exige la fecha del acta y no la admite futura", () => {
    expect(errorModificacion(mod({ tipo: "PRORROGA", fecha: null }), hoy)).toMatch(/fecha de suscripción/);
    expect(errorModificacion(mod({ tipo: "PRORROGA", fecha: "2026-10-20" }), hoy)).toMatch(/posterior a hoy/);
    expect(errorModificacion(mod({ tipo: "PRORROGA" }), hoy)).toBeNull();
  });

  it("pide la clase de terminación y la descripción de una aclaración", () => {
    expect(errorModificacion(mod({ tipo: "TERMINACION_ANTICIPADA" }), hoy)).toMatch(/mutuo acuerdo o unilateral/);
    expect(errorModificacion(mod({ tipo: "TERMINACION_ANTICIPADA", claseTerminacion: "UNILATERAL" }), hoy)).toBeNull();
    expect(errorModificacion(mod({ tipo: "OTRA" }), hoy)).toMatch(/Describa/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "Corrige el objeto" }), hoy)).toBeNull();
  });

  it("pide CDP y RP en adiciones y solo RP en vigencias futuras", () => {
    expect(soportesRequeridos({ tipo: "ADICION_VALOR" })).toEqual(["CDP", "RP"]);
    expect(soportesRequeridos({ tipo: "PRORROGA_Y_ADICION" })).toEqual(["CDP", "RP"]);
    expect(soportesRequeridos({ tipo: "VIGENCIAS_FUTURAS" })).toEqual(["RP"]);
    expect(soportesRequeridos({ tipo: "PRORROGA" })).toEqual([]);
    expect(soportesRequeridos({ tipo: "CESION" })).toEqual([]);
  });
});
