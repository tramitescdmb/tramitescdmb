import { describe, it, expect } from "vitest";
import { textoIdentificacionFirma, etiquetaDatoIdentificacion, esTipoIdentificacionFirma } from "./identificacion-firma";

describe("identificación en la firma", () => {
  it("imprime solo el tipo de documento elegido", () => {
    expect(textoIdentificacionFirma("13743564", "CC")).toBe("C.C. 13743564");
    expect(textoIdentificacionFirma("900123456-1", "NIT")).toBe("NIT 900123456-1");
  });

  it("sin tipo elegido conserva el rótulo anterior, y sin número no imprime nada", () => {
    expect(textoIdentificacionFirma("13743564", null)).toBe("C.C./NIT 13743564");
    expect(textoIdentificacionFirma("  ", "CC")).toBeNull();
    expect(textoIdentificacionFirma(null, "NIT")).toBeNull();
  });

  it("nombra el dato según el tipo", () => {
    expect(etiquetaDatoIdentificacion("CC")).toBe("Cédula de ciudadanía");
    expect(etiquetaDatoIdentificacion("NIT")).toBe("NIT");
    expect(etiquetaDatoIdentificacion(undefined)).toBe("Cédula o NIT");
    expect(esTipoIdentificacionFirma("NIT")).toBe(true);
    expect(esTipoIdentificacionFirma("TI")).toBe(false);
  });
});
