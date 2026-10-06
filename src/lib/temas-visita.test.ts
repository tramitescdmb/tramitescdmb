import { describe, expect, it } from "vitest";
import { TEMAS_VISITA_BASE, documentoCubiertoPorVisita, esPasoDeProgramarVisita, esPasoDeVisita, normalizarNombreTema, ordenarTemasParaTramite } from "./temas-visita";

describe("temas de visita", () => {
  it("no repite nombres en el catálogo base", () => {
    const nombres = TEMAS_VISITA_BASE.map((t) => t.nombre.toLowerCase());
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("sugiere primero los temas del procedimiento y luego los generales", () => {
    const temas = [
      { nombre: "General", codigosTramite: [] },
      { nombre: "Cauce", codigosTramite: ["M-DA-PR39"] },
      { nombre: "Aire", codigosTramite: ["M-DA-PR07"] },
    ];
    const { sugeridos, otros } = ordenarTemasParaTramite(temas, "M-DA-PR39");
    expect(sugeridos.map((t) => t.nombre)).toEqual(["Cauce", "General"]);
    expect(otros.map((t) => t.nombre)).toEqual(["Aire"]);
  });

  it("normaliza el nombre de un tema nuevo", () => {
    expect(normalizarNombreTema("  revisión   de taludes ")).toBe("Revisión de taludes");
  });

  it("distingue el paso de realizar la visita del de programarla", () => {
    expect(esPasoDeVisita("REALIZAR VISITA TÉCNICA Y ELABORAR CONCEPTO TÉCNICO")).toBe(true);
    expect(esPasoDeVisita("NOTIFICAR EL AUTO DE TRÁMITE Y PROGRAMAR LA VISITA")).toBe(false);
    expect(esPasoDeProgramarVisita("ASIGNAR TÉCNICO RESPONSABLE PARA LA VISITA")).toBe(true);
  });

  it("reconoce los documentos que cubre la hoja de visita", () => {
    expect(documentoCubiertoPorVisita("Hoja de Visita Institucional", { conFotos: false })).toBe(true);
    expect(documentoCubiertoPorVisita("Registro fotográfico", { conFotos: false })).toBe(false);
    expect(documentoCubiertoPorVisita("Registro fotográfico", { conFotos: true })).toBe(true);
    expect(documentoCubiertoPorVisita("Concepto Técnico", { conFotos: true })).toBe(false);
  });
});
