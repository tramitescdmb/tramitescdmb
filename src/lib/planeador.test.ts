import { describe, expect, it } from "vitest";
import { desplazarMes, expedienteEnEjecucion, fechaHoraColombia, mesValido, partesColombia, rangoMes, semanasDelMes } from "./planeador";

describe("fechaHoraColombia / partesColombia", () => {
  it("interpreta fecha y hora en hora de Colombia y la devuelve igual", () => {
    const d = fechaHoraColombia("2026-10-06", "08:30")!;
    expect(d.toISOString()).toBe("2026-10-06T13:30:00.000Z");
    expect(partesColombia(d)).toEqual({ fecha: "2026-10-06", hora: "08:30" });
  });

  it("conserva la fecha local en la noche", () => {
    const d = fechaHoraColombia("2026-10-06", "22:15")!;
    expect(partesColombia(d)).toEqual({ fecha: "2026-10-06", hora: "22:15" });
  });

  it("rechaza formatos inválidos", () => {
    expect(fechaHoraColombia("06/10/2026", "08:30")).toBeNull();
    expect(fechaHoraColombia("2026-10-06", "8:30")).toBeNull();
  });
});

describe("meses", () => {
  it("desplaza entre años", () => {
    expect(desplazarMes(2026, 12, 1)).toEqual({ anio: 2027, mes: 1 });
    expect(desplazarMes(2026, 1, -1)).toEqual({ anio: 2025, mes: 12 });
  });

  it("usa el mes actual si el parámetro no es válido", () => {
    expect(mesValido("2026-13", new Date("2026-10-06T15:00:00Z"))).toEqual({ anio: 2026, mes: 10 });
    expect(mesValido("2027-02")).toEqual({ anio: 2027, mes: 2 });
  });

  it("calcula el rango del mes en hora de Colombia", () => {
    const { desde, hasta } = rangoMes(2026, 10);
    expect(desde.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("arma semanas de lunes a domingo", () => {
    const semanas = semanasDelMes(2026, 10);
    expect(semanas[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(semanas.flat().filter(Boolean)).toHaveLength(31);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
  });
});

describe("expedienteEnEjecucion", () => {
  it("excluye estados finales y archivados", () => {
    expect(expedienteEnEjecucion({ estado: "EN_TRAMITE", archivado: false })).toBe(true);
    expect(expedienteEnEjecucion({ estado: "APROBADO", archivado: false })).toBe(false);
    expect(expedienteEnEjecucion({ estado: "EN_TRAMITE", archivado: true })).toBe(false);
  });
});
