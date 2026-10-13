import { describe, expect, it } from "vitest";
import { errorCuantia, minimaCuantia } from "@/lib/cuantias";

const tope = { anio: 2026, menorCuantia: 500_000_000, soporte: null };

describe("topes de cuantía", () => {
  it("calcula la mínima cuantía como el 10 % de la menor", () => {
    expect(minimaCuantia(tope)).toBe(50_000_000);
  });

  it("no valida sin tope registrado o sin valor", () => {
    expect(errorCuantia("MINIMA_CUANTIA", 900_000_000, null)).toBeNull();
    expect(errorCuantia("MINIMA_CUANTIA", null, tope)).toBeNull();
  });

  it("limita la mínima cuantía y la menor cuantía a sus topes", () => {
    expect(errorCuantia("MINIMA_CUANTIA", 50_000_000, tope)).toBeNull();
    expect(errorCuantia("MINIMA_CUANTIA", 50_000_001, tope)).toMatch(/supera la mínima/);
    expect(errorCuantia("SELECCION_ABREVIADA_MENOR_CUANTIA", 500_000_001, tope)).toMatch(/supera la menor/);
  });

  it("hace prevalecer la mínima cuantía por valor", () => {
    expect(errorCuantia("CONCURSO_MERITOS", 40_000_000, tope)).toMatch(/mínima cuantía/);
    expect(errorCuantia("SELECCION_ABREVIADA_SUBASTA_INVERSA", 40_000_000, tope)).toMatch(/mínima cuantía/);
    expect(errorCuantia("CONTRATACION_DIRECTA", 10_000_000, tope)).toBeNull();
  });

  it("envía a selección abreviada una licitación por debajo de la menor cuantía", () => {
    expect(errorCuantia("LICITACION_PUBLICA", 300_000_000, tope)).toMatch(/menor cuantía/);
    expect(errorCuantia("LICITACION_PUBLICA", 800_000_000, tope)).toBeNull();
  });
});
