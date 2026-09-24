import { describe, it, expect } from "vitest";
import { ordenarPorCalidad, rotuloCalidadFirma, esCalidadFirma, resumirPendientesFirma, textoPendientesFirma } from "./calidad-firma";

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

describe("resumen de pendientes por calidad", () => {
  it("cuenta firmante principal, proyectó, revisó y visto bueno por separado", () => {
    const r = resumirPendientesFirma([
      { rol: "FIRMA", calidad: "PRINCIPAL", puedeActuar: true },
      { rol: "FIRMA", calidad: null, puedeActuar: false },
      { rol: "FIRMA", calidad: "PROYECTO", puedeActuar: true },
      { rol: "FIRMA", calidad: "REVISO", puedeActuar: false },
      { rol: "VISTO_BUENO", calidad: null, puedeActuar: true },
      { rol: "LECTURA", calidad: null, puedeActuar: true },
    ]);
    expect(r).toEqual({ total: 5, listos: 3, principal: 2, proyecto: 1, reviso: 1, vistoBueno: 1 });
    expect(textoPendientesFirma(r)).toBe(
      "5 pendientes por firmar o revisar: 2 como firmante principal, 1 como proyectó, 1 como revisó, 1 de visto bueno · 3 ya pueden atenderse"
    );
  });
});
