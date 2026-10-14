import { describe, expect, it } from "vitest";
import { avisosGarantia, porcentajePlazo, resumenPagos } from "@/lib/garantias-pagos";

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
