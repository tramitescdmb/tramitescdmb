import { describe, expect, it } from "vitest";
import { estadoLiquidacion, plazosLiquidacion, requiereLiquidacion } from "@/lib/liquidacion";

const terminacion = new Date("2026-01-31T00:00:00Z");

describe("plazos de liquidación", () => {
  it("no exige liquidar prestación de servicios ni compraventa, salvo terminación anticipada", () => {
    expect(requiereLiquidacion("PRESTACION_SERVICIOS", false)).toBe(false);
    expect(requiereLiquidacion("COMPRAVENTA", false)).toBe(false);
    expect(requiereLiquidacion("PRESTACION_SERVICIOS", true)).toBe(true);
    expect(requiereLiquidacion("OBRA", false)).toBe(true);
  });

  it("suma 6 meses, 2 meses y 2 años", () => {
    const p = plazosLiquidacion(new Date("2026-03-15T00:00:00Z"));
    expect(p.mutuoAcuerdo.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(p.unilateral.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(p.residual.toISOString().slice(0, 10)).toBe("2028-11-15");
  });

  it("ajusta al último día del mes", () => {
    const p = plazosLiquidacion(new Date("2026-01-31T00:00:00Z"));
    expect(p.mutuoAcuerdo.toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(p.unilateral.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(p.residual.toISOString().slice(0, 10)).toBe("2028-09-30");
  });

  it("indica la fase según la fecha", () => {
    const base = { terminacion, tipoContrato: "OBRA", terminadoAnticipadamente: false, liquidado: false };
    expect(estadoLiquidacion({ ...base, hoy: new Date("2026-01-10T00:00:00Z") }).fase).toBe("en-ejecucion");
    expect(estadoLiquidacion({ ...base, hoy: new Date("2026-05-01T00:00:00Z") }).fase).toBe("mutuo-acuerdo");
    expect(estadoLiquidacion({ ...base, hoy: new Date("2026-08-15T00:00:00Z") }).fase).toBe("unilateral");
    expect(estadoLiquidacion({ ...base, hoy: new Date("2027-06-01T00:00:00Z") }).fase).toBe("residual");
    expect(estadoLiquidacion({ ...base, hoy: new Date("2029-01-01T00:00:00Z") }).fase).toBe("sin-competencia");
    expect(estadoLiquidacion({ ...base, liquidado: true, hoy: new Date("2026-05-01T00:00:00Z") }).fase).toBe("liquidado");
    expect(estadoLiquidacion({ ...base, tipoContrato: "PRESTACION_SERVICIOS", hoy: new Date("2026-05-01T00:00:00Z") }).fase).toBe("no-requiere");
  });
});
