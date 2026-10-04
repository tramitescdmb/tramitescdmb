import { describe, expect, it } from "vitest";
import { estadoDeCamposVital, municipioDeCamposVital } from "./vital-campos";

describe("campos de VITAL", () => {
  it("traduce el código DANE del municipio", () => {
    expect(municipioDeCamposVital({ Municipio: "68307" })).toBe("Girón");
    expect(municipioDeCamposVital({ Municipio: "68820" })).toBe("Tona");
    expect(municipioDeCamposVital({ Municipio: "05001" })).toBeNull();
    expect(municipioDeCamposVital(null)).toBeNull();
  });

  it("deduce el estado de una contingencia", () => {
    expect(estadoDeCamposVital({ "La fuente de la contingencia fue controlada?": "Si" })).toBe("Contingencia controlada");
    expect(estadoDeCamposVital({ "La fuente de la contingencia fue controlada?": "No" })).toBe("Contingencia no controlada");
    expect(estadoDeCamposVital({})).toBe("Radicada en VITAL");
  });
});
