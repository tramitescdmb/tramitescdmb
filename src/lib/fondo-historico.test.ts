import { describe, it, expect } from "vitest";
import { parseFechaFondo, filaAModelo, esFondoValido } from "@/lib/fondo-historico";

describe("parseFechaFondo", () => {
  it("acepta ISO y YYYY-MM-DD", () => {
    expect(parseFechaFondo("2015-06-01")?.getFullYear()).toBe(2015);
    expect(parseFechaFondo("2015-06-01T00:00:00.000Z")?.getFullYear()).toBe(2015);
  });
  it("acepta DD/MM/YYYY (formato Oracle)", () => {
    const d = parseFechaFondo("03/12/2009");
    expect(d?.getFullYear()).toBe(2009);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(3);
  });
  it("descarta vacíos y años imposibles (typos de captura)", () => {
    expect(parseFechaFondo("")).toBeNull();
    expect(parseFechaFondo(null)).toBeNull();
    expect(parseFechaFondo("0201-05-04")).toBeNull();
    expect(parseFechaFondo("2502-05-04")).toBeNull();
  });
});

describe("filaAModelo", () => {
  it("arma el id compuesto y deriva el año", () => {
    const m = filaAModelo("psdocuments", {
      ref_id: "482913",
      serie_id: 101,
      serie_nombre: "CORRESPONDENCIA",
      fecha: "2011-03-15",
      asunto: "  Solicitud de copia  ",
      campos: { NUMENTRADA: "0012" },
    });
    expect(m.id).toBe("psdocuments:482913");
    expect(m.refId).toBe("482913");
    expect(m.anio).toBe(2011);
    expect(m.asunto).toBe("Solicitud de copia");
    expect(m.campos).toEqual({ NUMENTRADA: "0012" });
    expect(m.tieneImagen).toBe(false);
  });
  it("normaliza cadenas vacías a null", () => {
    const m = filaAModelo("psdocuments", { ref_id: "1", razon_social: "   ", numero: "" });
    expect(m.razonSocial).toBeNull();
    expect(m.numero).toBeNull();
  });
});

describe("esFondoValido", () => {
  it("solo reconoce fondos declarados", () => {
    expect(esFondoValido("psdocuments")).toBe(true);
    expect(esFondoValido("cualquier-cosa")).toBe(false);
  });
});
