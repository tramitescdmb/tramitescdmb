import { describe, expect, it } from "vitest";
import { errorCodigoProceso, formatearCodigoProceso, identificacionContrato, prefijoProceso } from "@/lib/codigo-proceso";

describe("código de proceso", () => {
  it("toma el prefijo de la modalidad o de la causal de contratación directa", () => {
    expect(prefijoProceso("LICITACION_PUBLICA")).toBe("LP");
    expect(prefijoProceso("SELECCION_ABREVIADA_MENOR_CUANTIA")).toBe("SA-MC");
    expect(prefijoProceso("CONCURSO_MERITOS")).toBe("CM");
    expect(prefijoProceso("MINIMA_CUANTIA")).toBe("MC");
    expect(prefijoProceso("CONTRATACION_DIRECTA", "SERVICIOS_PROFESIONALES_APOYO")).toBe("CD-CPS");
    expect(prefijoProceso("CONTRATACION_DIRECTA", "ARRENDAMIENTO_INMUEBLES")).toBe("CD-A");
    expect(prefijoProceso("CONTRATACION_DIRECTA", null)).toBeNull();
  });

  it("usa cuatro dígitos y la vigencia", () => {
    expect(formatearCodigoProceso("CD-CPS", 12, 2026)).toBe("CD-CPS-0012-2026");
  });

  it("valida el formato y que corresponda a la modalidad", () => {
    expect(errorCodigoProceso("CD-CPS-0012-2026", "CONTRATACION_DIRECTA", "SERVICIOS_PROFESIONALES_APOYO")).toBeNull();
    expect(errorCodigoProceso("LP-0012-2026", "CONTRATACION_DIRECTA", "SERVICIOS_PROFESIONALES_APOYO")).toMatch(/CD-CPS-0000-AAAA/);
    expect(errorCodigoProceso("CD-CPS-12-2026", "CONTRATACION_DIRECTA", "SERVICIOS_PROFESIONALES_APOYO")).not.toBeNull();
  });

  it("identifica el contrato por código y número", () => {
    expect(identificacionContrato({ codigoProceso: "CD-CPS-0001-2026", numeroContrato: "050-2026", numero: "CDMB-CTO-2026-000006" })).toBe(
      "CD-CPS-0001-2026 · Contrato N.° 050-2026"
    );
    expect(identificacionContrato({ codigoProceso: null, numeroContrato: null, numero: "CDMB-CTO-2026-000006" })).toBe("CDMB-CTO-2026-000006");
  });
});
