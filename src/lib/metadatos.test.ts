import { describe, it, expect } from "vitest";
import { validarMetadatos, metadatosIniciales, type CampoDef } from "./metadatos";

const campo = (over: Partial<CampoDef>): CampoDef => ({
  clave: "x",
  nombre: "Campo X",
  ayuda: null,
  tipo: "TEXTO",
  opciones: [],
  obligatorio: false,
  valorPorDefecto: null,
  ...over,
});

describe("validarMetadatos", () => {
  it("coacciona número, fecha, booleano y lista", () => {
    const campos: CampoDef[] = [
      campo({ clave: "n", tipo: "NUMERO" }),
      campo({ clave: "f", tipo: "FECHA" }),
      campo({ clave: "b", tipo: "BOOLEANO" }),
      campo({ clave: "l", tipo: "LISTA", opciones: ["Urbano", "Rural"] }),
    ];
    const { valores, errores } = validarMetadatos(campos, { n: "12,5", f: "2026-01-15", b: "on", l: "Rural" });
    expect(errores).toEqual([]);
    expect(valores).toEqual({ n: 12.5, f: "2026-01-15", b: true, l: "Rural" });
  });

  it("reporta obligatorio vacío y valores mal tipados", () => {
    const campos: CampoDef[] = [
      campo({ clave: "req", nombre: "Requerido", obligatorio: true }),
      campo({ clave: "n", nombre: "Número", tipo: "NUMERO" }),
      campo({ clave: "l", nombre: "Lista", tipo: "LISTA", opciones: ["A", "B"] }),
    ];
    const { errores } = validarMetadatos(campos, { req: "  ", n: "abc", l: "Z" });
    expect(errores).toHaveLength(3);
    expect(errores.some((e) => e.includes("Requerido"))).toBe(true);
    expect(errores.some((e) => e.includes("Número"))).toBe(true);
    expect(errores.some((e) => e.includes("Lista"))).toBe(true);
  });

  it("un campo opcional vacío no genera valor ni error", () => {
    const { valores, errores } = validarMetadatos([campo({ clave: "x" })], { x: "" });
    expect(valores).toEqual({});
    expect(errores).toEqual([]);
  });

  it("metadatosIniciales usa el valor guardado o el por defecto", () => {
    const campos: CampoDef[] = [campo({ clave: "a", valorPorDefecto: "def" }), campo({ clave: "b" })];
    expect(metadatosIniciales(campos, { b: "guardado" })).toEqual({ a: "def", b: "guardado" });
    expect(metadatosIniciales(campos, null)).toEqual({ a: "def", b: "" });
  });
});
