import { describe, expect, it } from "vitest";
import { aGms, avisoFueraDeSantander, decimalAGms, gmsADecimal } from "./coordenadas-geograficas";

describe("coordenadas geográficas", () => {
  it("convierte grados, minutos y segundos a decimales con hemisferio", () => {
    expect(gmsADecimal("7", "7", "9.66", "N")).toBeCloseTo(7.11935, 5);
    expect(gmsADecimal("73", "7", "21,87", "O")).toBeCloseTo(-73.122742, 5);
    expect(gmsADecimal("7", "", "", "S")).toBe(-7);
  });

  it("rechaza minutos o segundos fuera de rango", () => {
    expect(gmsADecimal("7", "60", "0", "N")).toBeNull();
    expect(gmsADecimal("7", "0", "60", "N")).toBeNull();
    expect(gmsADecimal("91", "0", "0", "N")).toBeNull();
    expect(gmsADecimal("", "1", "1", "N")).toBeNull();
    expect(gmsADecimal("x", "1", "1", "N")).toBeNull();
  });

  it("ida y vuelta decimal → GMS → decimal", () => {
    const g = decimalAGms(-73.1227416, false);
    expect(g.hemisferio).toBe("O");
    expect(gmsADecimal(String(g.grados), String(g.minutos), String(g.segundos), g.hemisferio)).toBeCloseTo(-73.1227416, 5);
  });

  it("no muestra 60 segundos por redondeo", () => {
    expect(aGms(7.9999999, true)).toBe('8° 0\' 0,00" N');
    expect(aGms(-73.122742, false)).toMatch(/^73° 7' 21,87" O$/);
  });

  it("advierte fuera de Santander sin bloquear", () => {
    expect(avisoFueraDeSantander(7.119, -73.122)).toBeNull();
    expect(avisoFueraDeSantander(7.119, 73.122)).toMatch(/positiva/);
    expect(avisoFueraDeSantander(-73.122, 7.119)).toMatch(/invertidas/);
    expect(avisoFueraDeSantander(4.6, -74.08)).toMatch(/por fuera de Santander/);
  });
});
