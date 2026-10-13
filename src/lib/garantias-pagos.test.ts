import { describe, expect, it } from "vitest";
import { avisosGarantia, porcentajePlazo, resumenPagos } from "@/lib/garantias-pagos";
import { errorModificacion, leerModificacion, nuevaFechaTerminacion } from "@/lib/modificaciones-contrato";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("garantías", () => {
  it("avisa si la garantía no cubre la terminación, falta aprobarla o hay una modificación posterior", () => {
    const g = { vigenciaHasta: d("2026-12-31"), aprobadaEn: d("2026-02-01"), createdAt: d("2026-02-01") };
    expect(avisosGarantia([g], d("2026-12-21"), [])).toEqual([]);
    expect(avisosGarantia([g], d("2027-02-15"), []).join(" ")).toMatch(/vence antes/);
    expect(avisosGarantia([{ ...g, aprobadaEn: null }], d("2026-12-21"), []).join(" ")).toMatch(/sin aprobar/);
    expect(avisosGarantia([g], d("2026-12-21"), [{ numero: 1, tipo: "ADICION_VALOR", createdAt: d("2026-06-01") }]).join(" ")).toMatch(/modificación N.° 1/);
    expect(avisosGarantia([], d("2026-12-21"), [])).toEqual([]);
  });
});

describe("pagos", () => {
  it("resume lo pagado, el saldo y el porcentaje", () => {
    expect(resumenPagos(20_000_000, [{ valor: 5_000_000 }, { valor: 5_000_000 }])).toEqual({ pagado: 10_000_000, saldo: 10_000_000, porcentaje: 50 });
    expect(porcentajePlazo(d("2026-01-01"), d("2026-12-31"), d("2026-07-02"))).toBeCloseTo(50, 0);
  });
});

describe("cesión y terminación anticipada", () => {
  const contrato = {
    terminacion: d("2026-12-21"),
    inicio: d("2026-02-01"),
    suscripcion: d("2026-01-20"),
    valorInicial: 20_000_000,
    tipoContrato: "PRESTACION_SERVICIOS",
    adiciones: [],
    hoy: d("2026-10-13"),
  };
  const mod = (v: Record<string, unknown>) => leerModificacion({ fecha: "2026-10-01", ...v })!;

  it("exige el cesionario", () => {
    expect(errorModificacion(mod({ tipo: "CESION" }), contrato)).toMatch(/cesionario/);
    expect(errorModificacion(mod({ tipo: "CESION", cesionarioUsuarioRed: "cardel02" }), contrato)).toBeNull();
  });

  it("valida la terminación anticipada y adelanta la terminación", () => {
    expect(errorModificacion(mod({ tipo: "TERMINACION_ANTICIPADA", fechaTerminacion: "2026-10-31" }), contrato)).toMatch(/mutuo acuerdo o unilateral/);
    expect(errorModificacion(mod({ tipo: "TERMINACION_ANTICIPADA", claseTerminacion: "MUTUO_ACUERDO", fechaTerminacion: "2026-12-30" }), contrato)).toMatch(/anterior/);
    const m = mod({ tipo: "TERMINACION_ANTICIPADA", claseTerminacion: "MUTUO_ACUERDO", fechaTerminacion: "2026-10-31" });
    expect(errorModificacion(m, contrato)).toBeNull();
    expect(nuevaFechaTerminacion(m, contrato.terminacion)?.toISOString().slice(0, 10)).toBe("2026-10-31");
  });
});
