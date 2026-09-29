import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extraerTextoPdf, recortarTextoPdf } from "./texto-pdf";

async function construirPdfDePrueba(texto: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  pagina.drawText(texto, { x: 50, y: pagina.getHeight() - 50, size: 14, font: fuente });
  return pdf.save();
}

describe("recortarTextoPdf", () => {
  it("colapsa espacios en blanco repetidos", () => {
    expect(recortarTextoPdf("Hola   mundo\n\ncon   saltos")).toBe("Hola mundo con saltos");
  });

  it("recorta al máximo de caracteres indicado", () => {
    expect(recortarTextoPdf("a".repeat(100), 10)).toHaveLength(10);
  });

  it("no toca texto ya dentro del límite", () => {
    expect(recortarTextoPdf("texto corto", 1000)).toBe("texto corto");
  });
});

describe("extraerTextoPdf", () => {
  it("extrae el texto real de un PDF válido", async () => {
    const bytes = await construirPdfDePrueba("Resolucion de prueba CDMB-2026-001");
    const texto = await extraerTextoPdf(bytes);
    expect(texto).toContain("Resolucion de prueba CDMB-2026-001");
  });

  it("devuelve null ante bytes que no son un PDF", async () => {
    const texto = await extraerTextoPdf(Buffer.from("esto no es un pdf"));
    expect(texto).toBeNull();
  });
});
