import { describe, expect, it } from "vitest";
import { areaPoligonoM2, distanciaM, formatoArea, formatoDistancia, puntoEnPoligono } from "./negocios-verdes-medir";

describe("medidas del geovisor", () => {
  it("distancia: un grado de latitud son unos 111 km", () => {
    expect(distanciaM([7, -73], [8, -73])).toBeGreaterThan(110_000);
    expect(distanciaM([7, -73], [8, -73])).toBeLessThan(112_000);
  });
  it("área: un cuadrado de 0,01° cerca de Bucaramanga mide unas 122 ha", () => {
    const a = areaPoligonoM2([[7.1, -73.1], [7.11, -73.1], [7.11, -73.11], [7.1, -73.11]]);
    expect(a / 10000).toBeGreaterThan(118);
    expect(a / 10000).toBeLessThan(126);
  });
  it("punto dentro y fuera de la zona", () => {
    const z: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]];
    expect(puntoEnPoligono([0.5, 0.5], z)).toBe(true);
    expect(puntoEnPoligono([1.5, 0.5], z)).toBe(false);
  });
  it("formatos", () => {
    expect(formatoDistancia(850)).toBe("850 m");
    expect(formatoDistancia(2500)).toBe("2,50 km");
    expect(formatoArea(5000)).toBe("5.000 m²");
    expect(formatoArea(25000)).toBe("2,50 ha");
  });
});
