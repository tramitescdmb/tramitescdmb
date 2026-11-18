import { describe, it, expect } from "vitest";
import { conteoDocsVital, urlDescargaVital, urlVitalPublico } from "@/lib/vital-links";

describe("urlVitalPublico", () => {
  it("arma la url del buscador público de VITAL por idVital (verificada a mano)", () => {
    expect(urlVitalPublico("1210006354366726001")).toBe(
      "https://vital-publico.minambiente.gov.co/buscador?dato=1210006354366726001&prefiltro=Todos",
    );
  });
});

describe("urlDescargaVital", () => {
  it("agrega la marca de tiempo como lo hace SINCA", () => {
    expect(urlDescargaVital("http://vital/archivo.pdf", 123)).toBe("http://vital/archivo.pdf?_t=123");
    expect(urlDescargaVital("http://vital/descarga?id=9", 123)).toBe("http://vital/descarga?id=9&_t=123");
  });
});

describe("conteoDocsVital", () => {
  it("cuenta los reportados por VITAL aunque no estén guardados", () => {
    expect(conteoDocsVital(0, 3)).toEqual({ total: 3, enVital: 3 });
    expect(conteoDocsVital(2, 3)).toEqual({ total: 3, enVital: 1 });
    expect(conteoDocsVital(2, null)).toEqual({ total: 2, enVital: 0 });
    expect(conteoDocsVital(0, 0)).toEqual({ total: 0, enVital: 0 });
  });
});
