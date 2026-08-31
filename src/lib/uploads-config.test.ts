import { describe, expect, it } from "vitest";
import { extensionDe, extensionPermitida, mensajeTipoNoPermitido } from "./uploads-config";

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
