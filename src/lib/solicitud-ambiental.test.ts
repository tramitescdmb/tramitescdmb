import { describe, expect, it } from "vitest";
import {
  FORMATO_NUMERO_SOLICITUD,
  contenidoCorrespondeAExtension,
  generarNumeroSolicitud,
  normalizarIdentificacion,
  normalizarNumeroSolicitud,
} from "./solicitud-ambiental";

describe("número de solicitud", () => {
  it("se genera con el formato SA-XXXX-XXXX y sin caracteres confusos", () => {
    for (let i = 0; i < 200; i++) {
      const n = generarNumeroSolicitud();
      expect(n).toMatch(FORMATO_NUMERO_SOLICITUD);
      expect(n.slice(3)).not.toMatch(/[01OIL]/);
    }
  });

  it("no es consecutivo: dos números seguidos difieren", () => {
    const vistos = new Set(Array.from({ length: 500 }, generarNumeroSolicitud));
    expect(vistos.size).toBe(500);
  });

  it("acepta minúsculas, espacios y sin guiones", () => {
    expect(normalizarNumeroSolicitud("sa 7kq4 m9xd")).toBe("SA-7KQ4-M9XD");
    expect(normalizarNumeroSolicitud("7KQ4M9XD")).toBe("SA-7KQ4-M9XD");
    expect(normalizarNumeroSolicitud("SA-7KQ4-M9X")).toBeNull();
    expect(normalizarNumeroSolicitud("SA-7KQ4-M9X0")).toBeNull();
    expect(normalizarNumeroSolicitud("")).toBeNull();
  });
});

describe("cédula o NIT", () => {
  it("compara solo los dígitos y sin el dígito de verificación", () => {
    expect(normalizarIdentificacion("900.123.456-1")).toBe("900123456");
    expect(normalizarIdentificacion("900123456")).toBe("900123456");
    expect(normalizarIdentificacion(" 91.234.567 ")).toBe("91234567");
  });
});

describe("contenido de los archivos", () => {
  const bytes = (...b: number[]) => Uint8Array.from(b);
  it("reconoce PDF, imágenes y Office por sus primeros bytes", () => {
    expect(contenidoCorrespondeAExtension("a.pdf", bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe(true);
    expect(contenidoCorrespondeAExtension("a.PNG", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe(true);
    expect(contenidoCorrespondeAExtension("a.jpg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(contenidoCorrespondeAExtension("a.docx", bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
    expect(contenidoCorrespondeAExtension("a.xls", bytes(0xd0, 0xcf, 0x11, 0xe0))).toBe(true);
  });
  it("rechaza un archivo cuyo contenido no corresponde a la extensión", () => {
    expect(contenidoCorrespondeAExtension("a.pdf", bytes(0x4d, 0x5a, 0x90, 0x00))).toBe(false); // ejecutable
    expect(contenidoCorrespondeAExtension("a.pdf", bytes(0x3c, 0x68, 0x74, 0x6d))).toBe(false); // HTML
    expect(contenidoCorrespondeAExtension("a.exe", bytes(0x4d, 0x5a))).toBe(false);
    expect(contenidoCorrespondeAExtension("a.pdf", bytes())).toBe(false);
  });
});
