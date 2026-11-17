import { describe, expect, it } from "vitest";
import { esRequisitoPlano, extensionDe, extensionPermitida, mensajeTipoNoPermitido } from "./uploads-config";

describe("extensionDe", () => {
  it("toma lo que sigue al último punto, en minúsculas", () => {
    expect(extensionDe("Certificado.PDF")).toBe("pdf");
    expect(extensionDe("plano.final.dwg.pdf")).toBe("pdf");
  });

  it("sin punto no hay extensión", () => {
    expect(extensionDe("archivo_sin_extension")).toBe("");
  });
});

describe("extensionPermitida", () => {
  it("acepta los formatos que la app promete en los textos de ayuda", () => {
    for (const nombre of ["cedula.pdf", "foto.jpg", "foto.JPEG", "plano.png", "certificado.docx", "anexo.xlsx"]) {
      expect(extensionPermitida(nombre)).toBe(true);
    }
  });

  it("rechaza tipos no permitidos (ej. ejecutables)", () => {
    expect(extensionPermitida("instalador.exe")).toBe(false);
    expect(extensionPermitida("script.js")).toBe(false);
    expect(extensionPermitida("sin_extension")).toBe(false);
  });
});

describe("mensajeTipoNoPermitido", () => {
  it("incluye el nombre del archivo rechazado", () => {
    expect(mensajeTipoNoPermitido("virus.exe")).toContain("virus.exe");
  });
});

describe("esRequisitoPlano", () => {
  it("reconoce los requisitos de planos", () => {
    expect(esRequisitoPlano("Planos que soportan el EIA, conforme al Modelo de Almacenamiento Geográfico")).toBe(true);
    expect(esRequisitoPlano("Plano de localización de la fuente hídrica en el área de influencia")).toBe(true);
    expect(esRequisitoPlano("Memorias técnicas, diseños de ingeniería y planos de detalle")).toBe(true);
  });
  it("no confunde otras palabras", () => {
    expect(esRequisitoPlano("Formulario único nacional")).toBe(false);
    expect(esRequisitoPlano("Certificado de planificación predial")).toBe(false);
    expect(esRequisitoPlano("Archivos planosos")).toBe(false);
  });
});
