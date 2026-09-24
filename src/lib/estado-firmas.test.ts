import { describe, it, expect } from "vitest";
import { estadoPorFirmas } from "./estado-firmas";

const h = (hora: number) => new Date(Date.UTC(2026, 8, 23, hora));

describe("estadoPorFirmas", () => {
  it("sin firmantes asignados el documento queda aprobado", () => {
    expect(estadoPorFirmas([])).toBe("APROBADO");
  });

  it("todas las firmas completadas aprueban el documento", () => {
    expect(estadoPorFirmas([{ estado: "COMPLETADA", asignadoEn: h(8), completadoEn: h(9) }])).toBe("APROBADO");
  });

  it("un rechazo vigente deja el documento rechazado", () => {
    expect(
      estadoPorFirmas([
        { estado: "COMPLETADA", asignadoEn: h(8), completadoEn: h(9) },
        { estado: "RECHAZADA", asignadoEn: h(8), completadoEn: h(10) },
      ])
    ).toBe("RECHAZADO");
  });

  it("un rechazo seguido de una nueva asignación firmada deja el documento aprobado", () => {
    expect(
      estadoPorFirmas([
        { estado: "RECHAZADA", asignadoEn: h(8), completadoEn: h(9) },
        { estado: "COMPLETADA", asignadoEn: h(10), completadoEn: h(11) },
      ])
    ).toBe("APROBADO");
  });

  it("un rechazo seguido de una nueva asignación aún sin firmar vuelve a pendiente", () => {
    expect(
      estadoPorFirmas([
        { estado: "RECHAZADA", asignadoEn: h(8), completadoEn: h(9) },
        { estado: "PENDIENTE", asignadoEn: h(10), completadoEn: null },
      ])
    ).toBe("PENDIENTE");
  });

  it("con firmas aún pendientes y sin rechazos sigue pendiente", () => {
    expect(
      estadoPorFirmas([
        { estado: "COMPLETADA", asignadoEn: h(8), completadoEn: h(9) },
        { estado: "PENDIENTE", asignadoEn: h(8), completadoEn: null },
      ])
    ).toBe("PENDIENTE");
  });
});
