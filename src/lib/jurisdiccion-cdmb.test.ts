import { describe, expect, it } from "vitest";
import { puntoDentroDeFeatures, puntoEnGeometria } from "./jurisdiccion-cdmb";

// Cuadrado de 1°x1° en lon/lat (GeoJSON es [lon, lat]), sin huecos.
const CUADRADO: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

describe("puntoEnGeometria", () => {
  it("detecta un punto dentro de un Polygon simple", () => {
    expect(puntoEnGeometria(0.5, 0.5, { type: "Polygon", coordinates: [CUADRADO] })).toBe(true);
  });

  it("detecta un punto fuera de un Polygon simple", () => {
    expect(puntoEnGeometria(5, 5, { type: "Polygon", coordinates: [CUADRADO] })).toBe(false);
  });

  it("respeta un hueco (segundo anillo) dentro del polígono", () => {
    const hueco: [number, number][] = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ];
    const conHueco: { type: "Polygon"; coordinates: [number, number][][] } = { type: "Polygon", coordinates: [CUADRADO, hueco] };
    expect(puntoEnGeometria(0.5, 0.5, conHueco)).toBe(false); // dentro del hueco
    expect(puntoEnGeometria(0.1, 0.1, conHueco)).toBe(true); // dentro del polígono, fuera del hueco
  });

  it("detecta un punto dentro de un MultiPolygon (cualquiera de sus partes)", () => {
    const otroCuadrado: [number, number][] = [
      [10, 10],
      [11, 10],
      [11, 11],
      [10, 11],
      [10, 10],
    ];
    const multi: { type: "MultiPolygon"; coordinates: [number, number][][][] } = { type: "MultiPolygon", coordinates: [[CUADRADO], [otroCuadrado]] };
    expect(puntoEnGeometria(10.5, 10.5, multi)).toBe(true);
    expect(puntoEnGeometria(0.5, 0.5, multi)).toBe(true);
    expect(puntoEnGeometria(20, 20, multi)).toBe(false);
  });
});

describe("puntoDentroDeFeatures", () => {
  it("es verdadero si el punto cae en cualquiera de las features", () => {
    const coleccion = {
      features: [
        { geometry: { type: "Polygon" as const, coordinates: [CUADRADO] } },
        { geometry: { type: "Polygon" as const, coordinates: [CUADRADO.map(([x, y]) => [x + 5, y + 5] as [number, number])] } },
      ],
    };
    expect(puntoDentroDeFeatures(0.5, 0.5, coleccion)).toBe(true);
    expect(puntoDentroDeFeatures(5.5, 5.5, coleccion)).toBe(true);
    expect(puntoDentroDeFeatures(20, 20, coleccion)).toBe(false);
  });
});
