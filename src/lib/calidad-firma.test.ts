import { describe, it, expect } from "vitest";
import { ordenarPorCalidad, rotuloCalidadFirma, esCalidadFirma } from "./calidad-firma";

describe("calidad de la firma", () => {
  it("ordena principal, luego proyectó y al final revisó, respetando el orden original dentro de cada grupo", () => {
    const firmas = [
      { n: "revisa", c: "REVISO" },
      { n: "proyecta", c: "PROYECTO" },
      { n: "principal-1", c: "PRINCIPAL" },
      { n: "sin-calidad", c: null },
      { n: "principal-2", c: "PRINCIPAL" },
    ];
    expect(ordenarPorCalidad(firmas, (f) => f.c).map((f) => f.n)).toEqual(["principal-1", "sin-calidad", "principal-2", "proyecta", "revisa"]);
  });

  it("el firmante principal no lleva rótulo; proyectó y revisó sí", () => {
    expect(rotuloCalidadFirma("PRINCIPAL")).toBeNull();
    expect(rotuloCalidadFirma(null)).toBeNull();
    expect(rotuloCalidadFirma("PROYECTO")).toBe("Proyectó");
    expect(rotuloCalidadFirma("REVISO")).toBe("Revisó");
  });

  it("solo acepta las tres calidades definidas", () => {
    expect(esCalidadFirma("PROYECTO")).toBe(true);
    expect(esCalidadFirma("OTRA")).toBe(false);
    expect(esCalidadFirma(undefined)).toBe(false);
  });
});
