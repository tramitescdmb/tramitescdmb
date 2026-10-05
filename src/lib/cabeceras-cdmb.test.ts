import { describe, expect, it } from "vitest";
import { cabeceraDeMunicipio } from "./cabeceras-cdmb";

describe("cabeceraDeMunicipio", () => {
  it("reconoce los municipios con o sin tilde y en cualquier mayúscula", () => {
    expect(cabeceraDeMunicipio("Giron")?.municipio).toBe("Girón");
    expect(cabeceraDeMunicipio("EL PLAYON")?.municipio).toBe("El Playón");
    expect(cabeceraDeMunicipio("Surata")?.municipio).toBe("Suratá");
  });

  it("no ubica municipios fuera de la jurisdicción ni textos regionales", () => {
    expect(cabeceraDeMunicipio("BOGOTÁ")).toBeNull();
    expect(cabeceraDeMunicipio("Area metropolitana (B/manga, Florida, Girón)")).toBeNull();
    expect(cabeceraDeMunicipio(null)).toBeNull();
  });
});
