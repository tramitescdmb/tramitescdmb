import { describe, expect, it } from "vitest";
import { errorCombinacionContrato, tiposPermitidos } from "@/lib/compatibilidad-modalidad";

describe("tipo de contrato frente a modalidad de selección", () => {
  it("reserva el concurso de méritos a consultoría e interventoría", () => {
    expect(tiposPermitidos("CONCURSO_MERITOS")).toEqual(["CONSULTORIA", "INTERVENTORIA"]);
    expect(errorCombinacionContrato("CONCURSO_MERITOS", "OBRA")).toMatch(/concurso de méritos/);
    expect(errorCombinacionContrato("LICITACION_PUBLICA", "INTERVENTORIA")).toMatch(/concurso de méritos/);
    expect(errorCombinacionContrato("SELECCION_ABREVIADA_MENOR_CUANTIA", "CONSULTORIA")).toMatch(/concurso de méritos/);
  });

  it("no admite obra ni consultoría por subasta inversa", () => {
    expect(errorCombinacionContrato("SELECCION_ABREVIADA_SUBASTA_INVERSA", "OBRA")).toMatch(/uniformes/);
    expect(errorCombinacionContrato("SELECCION_ABREVIADA_SUBASTA_INVERSA", "SUMINISTRO")).toBeNull();
  });

  it("admite cualquier objeto por mínima cuantía", () => {
    expect(errorCombinacionContrato("MINIMA_CUANTIA", "INTERVENTORIA")).toBeNull();
    expect(errorCombinacionContrato("MINIMA_CUANTIA", "OBRA")).toBeNull();
  });

  it("exige la causal en contratación directa y la cruza con el tipo", () => {
    expect(errorCombinacionContrato("CONTRATACION_DIRECTA", "PRESTACION_SERVICIOS")).toMatch(/causal/);
    expect(errorCombinacionContrato("CONTRATACION_DIRECTA", "PRESTACION_SERVICIOS", "SERVICIOS_PROFESIONALES_APOYO")).toBeNull();
    expect(errorCombinacionContrato("CONTRATACION_DIRECTA", "OBRA", "SERVICIOS_PROFESIONALES_APOYO")).toMatch(/no admite/);
    expect(errorCombinacionContrato("CONTRATACION_DIRECTA", "ARRENDAMIENTO", "ARRENDAMIENTO_INMUEBLES")).toBeNull();
    expect(errorCombinacionContrato("CONTRATACION_DIRECTA", "OBRA", "INTERADMINISTRATIVO")).toBeNull();
    expect(tiposPermitidos("CONTRATACION_DIRECTA", "ADQUISICION_INMUEBLES")).toEqual(["COMPRAVENTA"]);
  });

  it("limita la enajenación y el arrendamiento a su objeto", () => {
    expect(errorCombinacionContrato("SELECCION_ABREVIADA_ENAJENACION_BIENES", "OBRA")).not.toBeNull();
    expect(errorCombinacionContrato("ARRENDAMIENTO", "COMPRAVENTA")).not.toBeNull();
  });
});
