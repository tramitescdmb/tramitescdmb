import { describe, expect, it } from "vitest";
import { componerActo, descomponerActo, errorPartesActo, normalizarActoAdministrativo } from "./acto-administrativo";

describe("acto administrativo del cargo", () => {
  it("compone tipo, número y año con un formato único", () => {
    expect(componerActo({ tipo: "Resolución", numero: "560", anio: "2026" })).toBe("Resolución 560 de 2026");
    expect(componerActo({ tipo: "Acta de posesión", numero: "12", anio: "2025" })).toBe("Acta de posesión 12 de 2025");
  });

  it("vacío no es error y no se guarda", () => {
    expect(errorPartesActo({ tipo: "", numero: "", anio: "" })).toBeNull();
    expect(normalizarActoAdministrativo("  ")).toEqual({ valor: null, error: null });
  });

  it("exige las tres partes cuando se diligencia alguna", () => {
    expect(errorPartesActo({ tipo: "Resolución", numero: "", anio: "2026" })).toMatch(/número/);
    expect(errorPartesActo({ tipo: "Resolución", numero: "560", anio: "26" })).toMatch(/año/);
    expect(errorPartesActo({ tipo: "", numero: "560", anio: "2026" })).toMatch(/tipo/);
  });

  it("lee lo ya guardado, con o sin «N.°», y normaliza la escritura", () => {
    expect(descomponerActo("Resolución 1520 de 2026")).toEqual({ tipo: "Resolución", numero: "1520", anio: "2026" });
    expect(descomponerActo("resolución N.° 560 de 2026")).toEqual({ tipo: "Resolución", numero: "560", anio: "2026" });
    expect(normalizarActoAdministrativo("decreto 45 de 2024")).toEqual({ valor: "Decreto 45 de 2024", error: null });
  });

  it("rechaza tipos fuera de la lista", () => {
    expect(normalizarActoAdministrativo("Resolucion 560 de 2026").error).toMatch(/tipo/);
  });
});
