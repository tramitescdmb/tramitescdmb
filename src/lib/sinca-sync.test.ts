import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { puntoDeSolicitud } = await import("./sinca-sync");

describe("puntoDeSolicitud", () => {
  it("lee coordx_sol como norte y coordy_sol como este (planas MAGNA origen Bogotá)", () => {
    const p = puntoDeSolicitud({ coordx_sol: 1276813, coordy_sol: 1100492 });
    expect(p!.lat).toBeCloseTo(7.0985, 3);
    expect(p!.lon).toBeCloseTo(-73.1679, 3);
  });

  it("convierte grados, minutos y segundos con longitud al occidente", () => {
    const p = puntoDeSolicitud({ latgrados_sol: 7, latmin_sol: 6, latseg_sol: 0, longrados_sol: 73, longmin_sol: 6, longseg_sol: 0 });
    expect(p).toEqual({ lat: 7.1, lon: -73.1 });
  });

  it("prefiere el geojson cuando viene", () => {
    expect(puntoDeSolicitud({ geojson_GMS: { coordinates: [-73.1, 7.1] }, coordx_sol: 1276813, coordy_sol: 1100492 })).toEqual({ lat: 7.1, lon: -73.1 });
  });

  it("descarta valores vacíos o fuera de la zona", () => {
    expect(puntoDeSolicitud({ coordx_sol: 0, coordy_sol: 0 })).toBeNull();
    expect(puntoDeSolicitud({ coordx_sol: "", coordy_sol: null })).toBeNull();
    expect(puntoDeSolicitud({ latgrados_sol: 4, longrados_sol: 74 })).toBeNull();
  });
});
