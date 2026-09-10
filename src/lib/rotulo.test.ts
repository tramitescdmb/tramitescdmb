import { describe, expect, it } from "vitest";
import { codigoBarrasRadicado, qrVerificacion, urlVerificacion } from "./rotulo";

describe("urlVerificacion", () => {
  it("arma la URL pública de verificación normalizando la barra final de la base", () => {
    expect(urlVerificacion("https://x.gov.co/", "CDMB-R-2026-000123")).toBe(
      "https://x.gov.co/verificar/CDMB-R-2026-000123",
    );
    expect(urlVerificacion("https://x.gov.co", "CDMB-R-2026-000123")).toBe(
      "https://x.gov.co/verificar/CDMB-R-2026-000123",
    );
  });
});

describe("códigos del rótulo", () => {
  it("codigoBarrasRadicado genera un SVG Code 128 con viewBox", () => {
    const svg = codigoBarrasRadicado("CDMB-R-2026-000123");
    expect(svg).toMatch(/^<svg[^>]*viewBox=/);
    expect(svg).toContain("</svg>");
  });

  it("qrVerificacion genera un SVG cuadrado", () => {
    const svg = qrVerificacion("https://x.gov.co", "CDMB-E-2026-000045");
    const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(m![2]); // QR es cuadrado
  });
});
