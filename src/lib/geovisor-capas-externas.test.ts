import { describe, expect, it } from "vitest";
import { clasificarPorTipo, COLOR_OTROS_TIPOS, PALETA_TIPOS, puntoExternoAReporte } from "./geovisor-capas-externas";

describe("clasificarPorTipo", () => {
  it("asigna colores en orden fijo según la cantidad de puntos de cada tipo", () => {
    const { grupos, grupoDe } = clasificarPorTipo([{ tipo: "B" }, { tipo: "A" }, { tipo: "A" }]);
    expect(grupos.map((g) => [g.clave, g.color, g.total])).toEqual([
      ["A", PALETA_TIPOS[0], 2],
      ["B", PALETA_TIPOS[1], 1],
    ]);
    expect(grupoDe("B").color).toBe(PALETA_TIPOS[1]);
  });

  it("agrupa en Otros los tipos que exceden la paleta", () => {
    const puntos = Array.from({ length: 10 }, (_, i) => ({ tipo: `T${i}` }));
    const { grupos, grupoDe } = clasificarPorTipo(puntos);
    expect(grupos).toHaveLength(PALETA_TIPOS.length + 1);
    expect(grupos.at(-1)).toMatchObject({ color: COLOR_OTROS_TIPOS, total: 2 });
    expect(grupoDe("T9").color).toBe(COLOR_OTROS_TIPOS);
  });
});

describe("puntoExternoAReporte", () => {
  it("conserva plataforma, tipo y enlace propio", () => {
    const r = puntoExternoAReporte(
      { nombre: "VITAL" },
      { clave: "X1", numero: "X1", tipo: "Concesión", detalle: null, municipio: null, estado: null, fecha: null, lat: 7.1, lon: -73.1, enlace: "/vital/abc" },
    );
    expect(r).toMatchObject({ plataforma: "VITAL", tramiteNombre: "Concesión", tramiteCodigo: "", enlace: "/vital/abc" });
  });
});
