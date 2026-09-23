import { describe, it, expect } from "vitest";
import { calcularPeriodosInforme, etiquetaRangoPeriodo, esRequisitoPorPeriodos, periodosPorRadicar } from "./periodos-informe";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const resumen = (a: string, b: string) => calcularPeriodosInforme(d(a), d(b)).map((p) => [p.clave, iso(p.desde), iso(p.hasta), iso(p.radicaDesde)]);

describe("calcularPeriodosInforme", () => {
  it("contrato del 25/09 al 24/12 → 4 periodos, recortados en los extremos", () => {
    expect(resumen("2026-09-25", "2026-12-24")).toEqual([
      ["2026-09", "2026-09-25", "2026-09-30", "2026-10-01"],
      ["2026-10", "2026-10-01", "2026-10-31", "2026-11-01"],
      ["2026-11", "2026-11-01", "2026-11-30", "2026-12-01"],
      ["2026-12", "2026-12-01", "2026-12-24", "2026-12-25"],
    ]);
  });

  it("un contrato dentro de un solo mes tiene un solo periodo", () => {
    expect(resumen("2026-09-10", "2026-09-28")).toEqual([["2026-09", "2026-09-10", "2026-09-28", "2026-09-29"]]);
  });

  it("inicio el día 1 y fin el último día del mes → meses completos", () => {
    expect(resumen("2026-01-01", "2026-03-31").map((p) => p.slice(0, 3))).toEqual([
      ["2026-01", "2026-01-01", "2026-01-31"],
      ["2026-02", "2026-02-01", "2026-02-28"],
      ["2026-03", "2026-03-01", "2026-03-31"],
    ]);
  });

  it("cruza el cambio de año y respeta el 29 de febrero", () => {
    const claves = calcularPeriodosInforme(d("2027-12-15"), d("2028-03-10")).map((p) => p.clave);
    expect(claves).toEqual(["2027-12", "2028-01", "2028-02", "2028-03"]);
    expect(resumen("2028-02-01", "2028-02-29")[0]![2]).toBe("2028-02-29");
  });

  it("sin fechas o con fin anterior al inicio → sin periodos", () => {
    expect(calcularPeriodosInforme(null, d("2026-01-01"))).toEqual([]);
    expect(calcularPeriodosInforme(d("2026-01-01"), undefined)).toEqual([]);
    expect(calcularPeriodosInforme(d("2026-05-02"), d("2026-05-01"))).toEqual([]);
  });

  it("ignora la hora del día (usa el día calendario en UTC)", () => {
    expect(calcularPeriodosInforme(new Date("2026-09-25T18:30:00Z"), new Date("2026-09-30T02:00:00Z"))).toHaveLength(1);
  });
});

describe("etiquetaRangoPeriodo / esRequisitoPorPeriodos", () => {
  it("formatea el rango y repite el año solo si cruza de año", () => {
    expect(etiquetaRangoPeriodo({ desde: d("2026-09-25"), hasta: d("2026-09-30") })).toBe("25 sep – 30 sep 2026");
    expect(etiquetaRangoPeriodo({ desde: d("2026-12-25"), hasta: d("2027-01-05") })).toBe("25 dic 2026 – 05 ene 2027");
  });
  it("el informe de supervisión (general y de obra pública), el formato de cumplimiento y el acta de pago parcial se entregan por periodos", () => {
    expect(esRequisitoPorPeriodos({ codigoFormato: "A-BS-FO116" })).toBe(true);
    expect(esRequisitoPorPeriodos({ codigoFormato: "A-BS-FO132" })).toBe(true);
    expect(esRequisitoPorPeriodos({ codigoFormato: "A-BS-FO127" })).toBe(true);
    expect(esRequisitoPorPeriodos({ codigoFormato: "A-BS-FO117" })).toBe(true);
    expect(esRequisitoPorPeriodos({ codigoFormato: "A-BS-FO74" })).toBe(false);
    expect(esRequisitoPorPeriodos({ codigoFormato: null })).toBe(false);
  });
});

describe("periodosPorRadicar", () => {
  const periodos = calcularPeriodosInforme(d("2026-09-25"), d("2026-12-24"));

  it("antes de que cierre el primer periodo no hay nada por radicar", () => {
    expect(periodosPorRadicar(periodos, new Set(), d("2026-09-30"))).toEqual([]);
  });

  it("el 1 de octubre ya se puede radicar el informe 1 (25 sep – 30 sep)", () => {
    const r = periodosPorRadicar(periodos, new Set(), d("2026-10-01"));
    expect(r.map((x) => [x.numero, x.periodo.clave, x.diasDeRetraso])).toEqual([[1, "2026-09", 0]]);
  });

  it("los ya cargados no cuentan y el retraso se mide desde el día de radicación", () => {
    const r = periodosPorRadicar(periodos, new Set(["2026-09"]), d("2026-11-05"));
    expect(r.map((x) => [x.numero, x.diasDeRetraso])).toEqual([[2, 4]]);
  });

  it("terminado el contrato, los 4 informes sin cargar están por radicar", () => {
    expect(periodosPorRadicar(periodos, new Set(), d("2027-01-15")).map((x) => x.numero)).toEqual([1, 2, 3, 4]);
  });
});
