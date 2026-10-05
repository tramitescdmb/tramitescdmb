import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { textoPdf } from "./caracteres-pdf";

describe("textoPdf", () => {
  it("conserva el español y la puntuación tipográfica", () => {
    expect(textoPdf("Resolución Nº 12 — «Año» ñandú “ok” …")).toBe("Resolución Nº 12 — «Año» ñandú “ok” …");
  });

  it("reemplaza lo que la fuente estándar no puede dibujar", () => {
    expect(textoPdf("Etapa 1 → 2 ≥ 3 ✓ Şahin 😀 漢")).toBe("Etapa 1 -> 2 >= 3 v Sahin ? ?");
  });

  it("el resultado siempre se puede dibujar con Helvetica", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(() => font.widthOfTextAtSize(textoPdf("Ꞩ ŉ Ǆ ŀ ő ű ć č 😀 → ≠ Ω"), 8)).not.toThrow();
  });
});
