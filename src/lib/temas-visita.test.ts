import { describe, expect, it } from "vitest";
import { TEMAS_VISITA_BASE, documentoCubiertoPorVisita, esPasoDeProgramarVisita, esPasoDeVisita, normalizarNombreTema, ordenarTemasParaTramite, pasoPermiteVisita, evaluarPasoParaVisita, visitaHabilitadaParaRegistro } from "./temas-visita";

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

  it("solo admite visitas en pasos de programar o realizar la visita", () => {
    expect(pasoPermiteVisita("NOTIFICAR EL AUTO DE TRÁMITE Y PROGRAMAR LA VISITA")).toBe(true);
    expect(pasoPermiteVisita("REALIZAR VISITA TÉCNICA")).toBe(true);
    expect(pasoPermiteVisita("RECIBIR, REVISAR Y RADICAR LA SOLICITUD DE TRÁMITE")).toBe(false);
    expect(pasoPermiteVisita("ELABORAR AUTO DE INICIO", "El Auto ordena la realización de la visita técnica de inspección ocular")).toBe(false);
    expect(pasoPermiteVisita("VERIFICAR LA INFORMACIÓN", "según sea necesario, realizará visitas de verificación a las instalaciones")).toBe(true);
    expect(pasoPermiteVisita("REGISTRAR SOLICITUD Y ASIGNAR FUNCIONARIO", "se asigna el trámite al profesional para programación de visita técnica")).toBe(true);
  });

  it("explica en corto por qué un trámite no admite visita", () => {
    const pasos = [
      { numero: 1, titulo: "RECIBIR Y RADICAR" },
      { numero: 4, titulo: "NOTIFICAR EL AUTO Y PROGRAMAR LA VISITA" },
      { numero: 5, titulo: "REALIZAR VISITA TÉCNICA" },
    ];
    expect(evaluarPasoParaVisita(pasos, 4)).toEqual({ permite: true, motivo: null, motivoCorto: null });
    expect(evaluarPasoParaVisita(pasos, 1).motivoCorto).toBe("Está en el paso 1; las visitas van en el paso 4 o 5");
    expect(evaluarPasoParaVisita([{ numero: 1, titulo: "LIQUIDAR TASA" }], 1).motivoCorto).toBe("Su procedimiento no contempla visitas");
  });

  it("habilita el registro desde el día programado", () => {
    expect(visitaHabilitadaParaRegistro("2026-10-06", "2026-10-06")).toBe(true);
    expect(visitaHabilitadaParaRegistro("2026-10-05", "2026-10-06")).toBe(true);
    expect(visitaHabilitadaParaRegistro("2026-10-07", "2026-10-06")).toBe(false);
  });

  it("reconoce los documentos que cubre la hoja de visita", () => {
    expect(documentoCubiertoPorVisita("Hoja de Visita Institucional", { conFotos: false })).toBe(true);
    expect(documentoCubiertoPorVisita("Registro fotográfico", { conFotos: false })).toBe(false);
    expect(documentoCubiertoPorVisita("Registro fotográfico", { conFotos: true })).toBe(true);
    expect(documentoCubiertoPorVisita("Concepto Técnico", { conFotos: true })).toBe(false);
  });
});
