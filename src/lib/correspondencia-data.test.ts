import { describe, it, expect } from "vitest";
import { parseConsultaBusqueda } from "@/lib/correspondencia-data";

describe("parseConsultaBusqueda (MoReq 4.2)", () => {
  it("un solo término", () => {
    expect(parseConsultaBusqueda("agua")).toEqual([{ texto: "agua", excluir: false }]);
  });

  it("varios términos se combinan (Y implícito)", () => {
    expect(parseConsultaBusqueda("concesion agua")).toEqual([
      { texto: "concesion", excluir: false },
      { texto: "agua", excluir: false },
    ]);
  });

  it("frase exacta entre comillas", () => {
    expect(parseConsultaBusqueda('"concesión de aguas"')).toEqual([
      { texto: "concesión de aguas", excluir: false },
    ]);
  });

  it("exclusión con guion", () => {
    expect(parseConsultaBusqueda("agua -residual")).toEqual([
      { texto: "agua", excluir: false },
      { texto: "residual", excluir: true },
    ]);
  });

  it("exclusión de una frase", () => {
    expect(parseConsultaBusqueda('permiso -"aguas lluvias"')).toEqual([
      { texto: "permiso", excluir: false },
      { texto: "aguas lluvias", excluir: true },
    ]);
  });

  it("el asterisco actúa como separador/comodín", () => {
    expect(parseConsultaBusqueda("vert*")).toEqual([{ texto: "vert", excluir: false }]);
    expect(parseConsultaBusqueda("perm*agua")).toEqual([
      { texto: "perm", excluir: false },
      { texto: "agua", excluir: false },
    ]);
  });

  it("un guion suelto no rompe nada", () => {
    expect(parseConsultaBusqueda("-")).toEqual([]);
  });
});
