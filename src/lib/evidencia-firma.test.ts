import { describe, expect, it } from "vitest";
import { navegadorLegible, textoSelloTiempo } from "./evidencia-firma";

describe("navegadorLegible", () => {
  it("resume navegador, versión y sistema", () => {
    expect(navegadorLegible("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")).toBe(
      "Chrome 141 en Windows 10/11"
    );
    expect(navegadorLegible("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0")).toBe(
      "Microsoft Edge 141 en Windows 10/11"
    );
    expect(navegadorLegible("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe(
      "Safari 18 en iOS"
    );
  });

  it("sin dato devuelve null", () => {
    expect(navegadorLegible(null)).toBeNull();
    expect(navegadorLegible("  ")).toBeNull();
  });
});

describe("textoSelloTiempo", () => {
  it("distingue la bitácora interna de un token RFC 3161", () => {
    const en = new Date("2026-10-15T17:09:05Z");
    expect(textoSelloTiempo({ en, fuente: "Bitácora encadenada del SGDEA (SHA-256)", token: null })).toMatch(/bitácora encadenada SHA-256 de la plataforma$/);
    expect(textoSelloTiempo({ en, fuente: "https://tsa.ejemplo.co", token: "MIIB..." })).toMatch(/token RFC 3161 de https:\/\/tsa\.ejemplo\.co$/);
    expect(textoSelloTiempo({ en: null, fuente: null, token: null })).toBeNull();
  });
});
