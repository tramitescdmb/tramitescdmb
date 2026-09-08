import { describe, expect, it } from "vitest";
import { formatearFecha, formatearFechaHora, fechaArchivoColombia } from "./fecha";

describe("formatearFecha / formatearFechaHora (hora de Colombia, UTC-5)", () => {
  it("null/undefined dan un guion, no truenan", () => {
    expect(formatearFecha(null)).toBe("—");
    expect(formatearFecha(undefined)).toBe("—");
    expect(formatearFechaHora(null)).toBe("—");
  });

  it("una 1am UTC cae en el día calendario ANTERIOR en Colombia (UTC-5)", () => {
    // 2026-09-08T01:00:00Z son las 8:00pm del 2026-09-07 en Bogotá.
    const d = new Date("2026-09-08T01:00:00.000Z");
    expect(formatearFecha(d)).toContain("07");
    expect(formatearFecha(d)).not.toContain("08 de sept");
    expect(formatearFechaHora(d)).toMatch(/08:00\s*p\.?\s*m\.?/i);
  });

  it("una hora que SÍ cae del mismo lado en ambas zonas no cambia de día", () => {
    // 2026-09-07T10:00:00Z = 5:00am en Bogotá, mismo día calendario en ambas.
    const d = new Date("2026-09-07T10:00:00.000Z");
    expect(formatearFecha(d)).toContain("07");
  });
});

describe("fechaArchivoColombia", () => {
  it("usa el día calendario de Colombia, no el de UTC", () => {
    const d = new Date("2026-09-08T01:00:00.000Z"); // 8pm del 7 en Bogotá
    expect(fechaArchivoColombia(d)).toBe("2026-09-07");
  });
});
