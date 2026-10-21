import { describe, expect, it } from "vitest";
import { interpretarLinea, interpretarPuntos } from "./puntos-entrada";

const cerca = (p: [number, number] | null, lat: number, lon: number) => {
  expect(p).not.toBeNull();
  expect(p![0]).toBeCloseTo(lat, 3);
  expect(p![1]).toBeCloseTo(lon, 3);
};

describe("puntos escritos a mano", () => {
  it("decimales con coma y espacio, sin espacio y con coma decimal", () => {
    cerca(interpretarLinea("7.1193, -73.1227"), 7.1193, -73.1227);
    cerca(interpretarLinea("7.1193,-73.1227"), 7.1193, -73.1227);
    cerca(interpretarLinea("7,1193 -73,1227"), 7.1193, -73.1227);
    cerca(interpretarLinea("7.1193;-73.1227"), 7.1193, -73.1227);
  });

  it("acepta longitud primero y longitud sin signo", () => {
    cerca(interpretarLinea("-73.1227 7.1193"), 7.1193, -73.1227);
    cerca(interpretarLinea("7.1193 73.1227"), 7.1193, -73.1227);
  });

  it("grados, minutos y segundos", () => {
    cerca(interpretarLinea(`7°07'09.5"N 73°07'21.7"W`), 7.11931, -73.12269);
    cerca(interpretarLinea(`7° 7' 9.5" N, 73° 7' 21.7" O`), 7.11931, -73.12269);
  });

  it("planas MAGNA origen Bogotá (Norte, Este) con o sin separador de miles", () => {
    const p = interpretarLinea("1277000 1105000");
    expect(p).not.toBeNull();
    expect(p![0]).toBeGreaterThan(6.5);
    expect(p![0]).toBeLessThan(7.6);
    cerca(interpretarLinea("1.277.000; 1.105.000"), p![0], p![1]);
    cerca(interpretarLinea("N 1277000 E 1105000"), p![0], p![1]);
  });

  it("toma las dos últimas cifras cuando la línea trae un nombre", () => {
    cerca(interpretarLinea("P1; 7.1193; -73.1227"), 7.1193, -73.1227);
  });

  it("rechaza puntos fuera de la zona o texto sin cifras", () => {
    expect(interpretarLinea("4.60, -74.08")).toBeNull();
    expect(interpretarLinea("hola")).toBeNull();
  });

  it("varias líneas, omitiendo las vacías", () => {
    const r = interpretarPuntos("7.1193, -73.1227\n\nnada\n7.12, -73.11");
    expect(r.map((l) => [l.linea, l.punto !== null])).toEqual([
      [1, true],
      [3, false],
      [4, true],
    ]);
  });
});
