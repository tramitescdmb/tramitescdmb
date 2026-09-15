import { describe, it, expect } from "vitest";
import { urlVitalPublico } from "@/lib/vital-links";

describe("urlVitalPublico", () => {
  it("arma la url del buscador público de VITAL por idVital (verificada a mano)", () => {
    expect(urlVitalPublico("1210006354366726001")).toBe(
      "https://vital-publico.minambiente.gov.co/buscador?dato=1210006354366726001&prefiltro=Todos",
    );
  });
});
