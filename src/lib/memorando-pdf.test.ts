import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { memorandoAPdf, partirEnLineas, textoSeguro, anchosColumnas } from "@/lib/memorando-pdf";

const firma = {
  id: "cmabc123firma",
  nombre: "Oscar Iván Rodríguez Mancilla",
  cargo: "Jefe Oficina Direccionamiento Estratégico Institucional",
  calidad: "Firmante principal",
  fecha: "23 nov 2026, 2:05 p. m.",
  hash: "a".repeat(64),
  formato: "Firma electrónica (hash SHA-256)",
  sello: null,
};

const datos = {
  numero: "ADEI – 054 /2026",
  ciudad: "Bucaramanga",
  fecha: "5 de febrero de 2026",
  para: { nombre: "Kelly Paola Restrepo Amaya", cargo: "Jefe Oficina de Control Interno" },
  de: { nombre: firma.nombre, cargo: firma.cargo },
  asunto: "Respuesta a memorando OCI-002-2026 “Solicitud información seguimiento política anti-trámites”",
  cuerpo: [
    "**1. Trámites y servicios** reportados ante el SUIT ≥ 2025:",
    "",
    "Adjunto me permito listar los trámites y servicios vigentes en la plataforma del SUIT, lo anterior confirmado con la Subdirección de Evaluación y Control a la Demanda Ambiental, así:".repeat(3),
    "",
    "| Código SUIT | Nombre del trámite y servicio | Fecha última actualización |",
    "|---|---|---|",
    ...Array.from({ length: 40 }, (_, i) => `| 192${i} | Concesión de aguas superficiales - Corporaciones ${i} | 13-05-2025 |`),
  ].join("\n"),
  proyecto: { nombre: "Luis Alfonso Lozano Camacho", cargo: "Profesional Especializado" },
  reviso: { nombre: "Ana Pérez", cargo: "Jefe ADEI" },
  estadoReviso: "Pendiente de firma",
  oficina: "Oficina ADEI",
  firma,
  firmaProyecto: { ...firma, id: "cmproy", nombre: "Luis Alfonso Lozano Camacho", calidad: "Proyectó" },
  firmaReviso: null,
  verificacion: { radicado: "CI-2026-000123", url: "https://192.168.7.61/verificar/CI-2026-000123", radicadoEn: "23 nov 2026" },
};

describe("PDF vectorial del memorando", () => {
  it("genera un PDF carta de varias páginas, sin imágenes, con caracteres fuera de WinAnsi reemplazados", async () => {
    const bytes = await memorandoAPdf(datos, "Memorando ADEI – 054 /2026");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const [ancho, alto] = [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()];
    expect([ancho, alto]).toEqual([612, 792]);
    expect(pdf.getTitle()).toBe("Memorando ADEI – 054 /2026");
    // Sin imágenes incrustadas: el texto es vectorial.
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("/Subtype /Image");
  });

  it("sin firmas ni verificación (vista previa) también se genera", async () => {
    const bytes = await memorandoAPdf({ ...datos, firma: null, firmaProyecto: null, verificacion: null, cuerpo: "" }, "x");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("parte en renglones sin pasarse del ancho y corta palabras muy largas", async () => {
    const pdf = await PDFDocument.create();
    const f = { normal: await pdf.embedFont(StandardFonts.Helvetica), negrilla: await pdf.embedFont(StandardFonts.HelveticaBold) };
    const lineas = partirEnLineas([{ texto: `uno dos **tres** ${"x".repeat(200)}`, negrilla: false }], 200, f, 11);
    expect(lineas.length).toBeGreaterThan(2);
    for (const l of lineas) {
      const ancho = l.reduce((a, t, i) => a + f.normal.widthOfTextAtSize(t.texto, 11) + (i && t.espacioAntes ? f.normal.widthOfTextAtSize(" ", 11) : 0), 0);
      expect(ancho).toBeLessThanOrEqual(200.5);
    }
    expect(textoSeguro("a ≥ b c ✓", f.normal)).toBe("a ? b c ?");
    const anchos = anchosColumnas([[[{ texto: "Código", negrilla: true }], [{ texto: "Nombre largo del trámite", negrilla: true }]]], f, 9.5, 400);
    expect(anchos.reduce((a, b) => a + b, 0)).toBeCloseTo(400);
  });
});
