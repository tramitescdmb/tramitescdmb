import { describe, expect, it } from "vitest";
import { etiquetaFormatoFirma } from "./firma-proveedor";
import { sha256Hex } from "./sello-tiempo";

describe("etiquetaFormatoFirma", () => {
  it("traduce los formatos conocidos y deja pasar los desconocidos", () => {
    expect(etiquetaFormatoFirma("hash-sha256")).toBe("Firma electrónica (hash SHA-256)");
    expect(etiquetaFormatoFirma("PAdES")).toBe("Firma digital PAdES");
    expect(etiquetaFormatoFirma("otro")).toBe("otro");
  });
});

describe("sha256Hex", () => {
  it("calcula el SHA-256 hex de un texto", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
