import { describe, expect, it } from "vitest";
import { errorModificacion, esDocumentoModificacion, leerModificacion, nuevaFechaTerminacion } from "@/lib/modificaciones-contrato";

const contrato = { terminacion: new Date("2026-12-21T00:00:00Z"), valorInicial: 20_000_000, adicionadoPrevio: 0 };

describe("modificaciones del contrato", () => {
  it("reconoce las actas de modificación", () => {
    expect(esDocumentoModificacion("Acta de concertación de prórroga del plazo")).toBe(true);
    expect(esDocumentoModificacion("Acta de concertación — adición de plazo y/o valor")).toBe(true);
    expect(esDocumentoModificacion("Acta de suspensión y reinicio")).toBe(true);
    expect(esDocumentoModificacion("Informe de supervisión")).toBe(false);
    expect(esDocumentoModificacion("Información adicional")).toBe(false);
    expect(esDocumentoModificacion("Certificado de Disponibilidad Presupuestal de la adición")).toBe(false);
  });

  it("valida la prórroga y exige vigencias futuras al cambiar de año", () => {
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA" })!, contrato)).toMatch(/nueva fecha/);
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2026-12-01" })!, contrato)).toMatch(/posterior/);
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2026-12-30" })!, contrato)).toBeNull();
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31" })!, contrato)).toMatch(/2027/);
    const vf = { clase: "ORDINARIA", acto: "Acuerdo 012 de 2026", valores: [{ anio: 2027, valor: 3_000_000 }] };
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31", vigenciasFuturas: { ...vf, acto: "" } })!, contrato)).toMatch(/acto/);
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31", vigenciasFuturas: vf })!, contrato)).toBeNull();
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2028-01-31", vigenciasFuturas: vf })!, contrato)).toMatch(/2028/);
  });

  it("limita las adiciones al 50 % del valor inicial", () => {
    expect(errorModificacion(leerModificacion({ tipo: "ADICION_VALOR" })!, contrato)).toMatch(/valor adicionado/);
    expect(errorModificacion(leerModificacion({ tipo: "ADICION_VALOR", valorAdicionado: 10_000_000 })!, contrato)).toBeNull();
    expect(errorModificacion(leerModificacion({ tipo: "ADICION_VALOR", valorAdicionado: 4_000_000 })!, { ...contrato, adicionadoPrevio: 7_000_000 })).toMatch(/50 %/);
  });

  it("corre la terminación los días suspendidos", () => {
    const m = leerModificacion({ tipo: "SUSPENSION", fechaSuspension: "2026-11-01", fechaReinicio: "2026-11-06" })!;
    expect(errorModificacion(m, contrato)).toBeNull();
    expect(nuevaFechaTerminacion(m, contrato.terminacion)?.toISOString().slice(0, 10)).toBe("2026-12-26");
  });

  it("pide descripción en una aclaración", () => {
    expect(errorModificacion(leerModificacion({ tipo: "OTRA" })!, contrato)).toMatch(/Describa/);
    expect(errorModificacion(leerModificacion({ tipo: "OTRA", observacion: "Corrige el objeto" })!, contrato)).toBeNull();
  });
});

describe("vigencias futuras por año", () => {
  it("lista cada año comprometido", async () => {
    const { vigenciasComprometidas, textoAnios } = await import("@/lib/modificaciones-contrato");
    const anios = vigenciasComprometidas(new Date("2026-12-21T00:00:00Z"), new Date("2028-03-31T00:00:00Z"));
    expect(anios).toEqual([2027, 2028]);
    expect(textoAnios(anios)).toBe("2027 y 2028");
    expect(errorModificacion(leerModificacion({ tipo: "PRORROGA", fechaTerminacion: "2028-03-31" })!, contrato)).toMatch(/2027 y 2028/);
  });
});

describe("tipo vigencias futuras", () => {
  it("exige clase, acto y valores por año", () => {
    expect(errorModificacion(leerModificacion({ tipo: "VIGENCIAS_FUTURAS" })!, contrato)).toMatch(/ordinarias o excepcionales/);
    expect(
      errorModificacion(leerModificacion({ tipo: "VIGENCIAS_FUTURAS", vigenciasFuturas: { clase: "EXCEPCIONAL", acto: "Acuerdo 3", valores: [{ anio: 2027, valor: 1 }] } })!, contrato)
    ).toBeNull();
  });
});
