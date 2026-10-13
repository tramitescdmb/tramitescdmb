import { describe, expect, it } from "vitest";
import {
  duracionPeriodo,
  errorModificacion,
  esDocumentoModificacion,
  leerModificacion,
  limiteAdicion,
  nuevaFechaTerminacion,
  periodosVigencias,
  soportesRequeridos,
  textoAnios,
  valoresConPeriodo,
  vigenciasComprometidas,
  type ContratoParaModificar,
} from "@/lib/modificaciones-contrato";

const contrato: ContratoParaModificar = {
  terminacion: new Date("2026-12-21T00:00:00Z"),
  inicio: new Date("2026-02-01T00:00:00Z"),
  suscripcion: new Date("2026-01-20T00:00:00Z"),
  valorInicial: 20_000_000,
  tipoContrato: "PRESTACION_SERVICIOS",
  adiciones: [],
  hoy: new Date("2026-10-13T00:00:00Z"),
};

const mod = (v: Record<string, unknown>) => leerModificacion({ fecha: "2026-10-01", ...v })!;

describe("modificaciones del contrato", () => {
  it("reconoce las actas de modificación", () => {
    expect(esDocumentoModificacion("Acta de concertación de prórroga del plazo")).toBe(true);
    expect(esDocumentoModificacion("Acta de concertación — adición de plazo y/o valor")).toBe(true);
    expect(esDocumentoModificacion("Acta de suspensión y reinicio")).toBe(true);
    expect(esDocumentoModificacion("Informe de supervisión")).toBe(false);
    expect(esDocumentoModificacion("Información adicional")).toBe(false);
    expect(esDocumentoModificacion("Certificado de Disponibilidad Presupuestal de la adición")).toBe(false);
  });

  it("solo procede durante la ejecución", () => {
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "x", fecha: null }), contrato)).toMatch(/fecha de suscripción/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "x", fecha: "2026-10-20" }), contrato)).toMatch(/posterior a hoy/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "x" }), { ...contrato, inicio: null })).toMatch(/fecha de inicio/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "x", fecha: "2026-01-25" }), contrato)).toMatch(/anterior al inicio/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "x" }), { ...contrato, terminacion: new Date("2026-09-30T00:00:00Z") })).toMatch(/vencido/);
  });

  it("valida la prórroga y exige vigencias futuras al cambiar de año", () => {
    expect(errorModificacion(mod({ tipo: "PRORROGA" }), contrato)).toMatch(/nueva fecha/);
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2026-12-01" }), contrato)).toMatch(/posterior/);
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2026-12-30" }), contrato)).toBeNull();
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31" }), contrato)).toMatch(/2027/);
    const vf = { clase: "ORDINARIA", acto: "Acuerdo 012 de 2026", valores: [{ anio: 2027, valor: 3_000_000 }] };
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31", vigenciasFuturas: { ...vf, acto: "" } }), contrato)).toMatch(/acto/);
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2027-01-31", vigenciasFuturas: vf }), contrato)).toBeNull();
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2028-01-31", vigenciasFuturas: vf }), contrato)).toMatch(/2028/);
  });

  it("limita las adiciones al 50 % del valor inicial en SMMLV", () => {
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR" }), contrato)).toMatch(/valor adicionado/);
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 10_000_000 }), contrato)).toBeNull();
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 10_000_001 }), contrato)).toMatch(/50 %/);
    const previa = { ...contrato, adiciones: [{ valor: 7_000_000, fecha: new Date("2026-06-01T00:00:00Z") }] };
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 4_000_000 }), previa)).toMatch(/50 %/);
  });

  it("convierte con el SMMLV del año de suscripción y el del año de la adición", () => {
    const de2025 = { ...contrato, suscripcion: new Date("2025-03-01T00:00:00Z"), inicio: new Date("2025-03-05T00:00:00Z"), valorInicial: 14_235_000 };
    const limite = limiteAdicion(de2025, new Date("2026-10-01T00:00:00Z"))!;
    expect(limite.inicialSm).toBeCloseTo(10, 6);
    expect(limite.disponibleSm).toBeCloseTo(5, 6);
    expect(limite.disponiblePesos).toBe(8_754_525);
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 8_754_525 }), de2025)).toBeNull();
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 8_800_000 }), de2025)).toMatch(/SMMLV/);
  });

  it("exime a la interventoría del límite del 50 %", () => {
    const interventoria = { ...contrato, tipoContrato: "INTERVENTORIA" };
    expect(limiteAdicion(interventoria, new Date("2026-10-01T00:00:00Z"))).toBeNull();
    expect(errorModificacion(mod({ tipo: "ADICION_VALOR", valorAdicionado: 30_000_000 }), interventoria)).toBeNull();
  });

  it("corre la terminación los días suspendidos", () => {
    const m = mod({ tipo: "SUSPENSION", fechaSuspension: "2026-11-01", fechaReinicio: "2026-11-06" });
    expect(errorModificacion(m, contrato)).toBeNull();
    expect(nuevaFechaTerminacion(m, contrato.terminacion)?.toISOString().slice(0, 10)).toBe("2026-12-26");
    expect(errorModificacion(mod({ tipo: "SUSPENSION", fechaSuspension: "2027-01-05", fechaReinicio: "2027-01-10" }), contrato)).toMatch(/plazo de ejecución/);
  });

  it("pide descripción en una aclaración", () => {
    expect(errorModificacion(mod({ tipo: "OTRA" }), contrato)).toMatch(/Describa/);
    expect(errorModificacion(mod({ tipo: "OTRA", observacion: "Corrige el objeto" }), contrato)).toBeNull();
  });
});

describe("vigencias futuras", () => {
  it("lista cada año comprometido", () => {
    const anios = vigenciasComprometidas(new Date("2026-12-21T00:00:00Z"), new Date("2028-03-31T00:00:00Z"));
    expect(anios).toEqual([2027, 2028]);
    expect(textoAnios(anios)).toBe("2027 y 2028");
    expect(errorModificacion(mod({ tipo: "PRORROGA", fechaTerminacion: "2028-03-31" }), contrato)).toMatch(/2027 y 2028/);
  });

  it("exige la fecha en la vigencia siguiente, clase, acto y valor", () => {
    expect(errorModificacion(mod({ tipo: "VIGENCIAS_FUTURAS" }), contrato)).toMatch(/fecha hasta/);
    expect(errorModificacion(mod({ tipo: "VIGENCIAS_FUTURAS", vigenciasFuturas: { hasta: "2026-12-30" } }), contrato)).toMatch(/posterior/);
    expect(errorModificacion(mod({ tipo: "VIGENCIAS_FUTURAS", vigenciasFuturas: { hasta: "2027-02-15" } }), contrato)).toMatch(/ordinarias o excepcionales/);
    expect(
      errorModificacion(
        mod({ tipo: "VIGENCIAS_FUTURAS", vigenciasFuturas: { clase: "EXCEPCIONAL", acto: "Acuerdo 3", hasta: "2027-02-15", valores: [{ anio: 2027, valor: 1 }] } }),
        contrato
      )
    ).toBeNull();
  });

  it("expresa el periodo en meses y días", () => {
    expect(duracionPeriodo("2027-01-01", "2027-02-15")).toBe("1 mes y 15 días");
    expect(duracionPeriodo("2027-01-01", "2027-01-20")).toBe("20 días");
    expect(duracionPeriodo("2027-01-01", "2027-12-31")).toBe("12 meses");
    expect(periodosVigencias(2026, new Date("2028-03-10T00:00:00Z"))).toEqual([
      { anio: 2027, desde: "2027-01-01", hasta: "2027-12-31" },
      { anio: 2028, desde: "2028-01-01", hasta: "2028-03-10" },
    ]);
    const m = mod({ tipo: "PRORROGA", fechaTerminacion: "2027-02-15", vigenciasFuturas: { valores: [{ anio: 2027, valor: 5 }, { anio: 2030, valor: 9 }] } });
    expect(valoresConPeriodo(m, contrato.terminacion)).toEqual([{ anio: 2027, valor: 5, desde: "2027-01-01", hasta: "2027-02-15" }]);
  });
});

describe("soportes presupuestales", () => {
  it("pide CDP solo con recursos nuevos y RP con adición o vigencias futuras", () => {
    expect(soportesRequeridos({ tipo: "ADICION_VALOR", vigenciasFuturas: false })).toEqual(["CDP", "RP"]);
    expect(soportesRequeridos({ tipo: "PRORROGA_Y_ADICION", vigenciasFuturas: true })).toEqual(["CDP", "RP"]);
    expect(soportesRequeridos({ tipo: "PRORROGA", vigenciasFuturas: true })).toEqual(["RP"]);
    expect(soportesRequeridos({ tipo: "VIGENCIAS_FUTURAS", vigenciasFuturas: true })).toEqual(["RP"]);
    expect(soportesRequeridos({ tipo: "PRORROGA", vigenciasFuturas: false })).toEqual([]);
    expect(soportesRequeridos({ tipo: "SUSPENSION", vigenciasFuturas: false })).toEqual([]);
  });
});
