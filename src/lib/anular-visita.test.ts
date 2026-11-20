import { describe, expect, it } from "vitest";
import { bloqueoCancelarVisita, bloqueoEliminarVisita, opcionesAnulacion, type VisitaParaAnular } from "@/lib/anular-visita";

const base: VisitaParaAnular = { estado: "PROGRAMADA", expedienteArchivado: false, hoja: null };
const hoja = { finalizadaEn: null, conceptoNumero: null, documentoConceptoId: null };

describe("anular visitas del Planeador", () => {
  it("una visita programada sin hoja se puede cancelar y eliminar", () => {
    expect(opcionesAnulacion(base)).toEqual({ cancelar: true, eliminar: true, bloqueoEliminar: null });
  });

  it("una visita realizada o no realizada se puede cancelar", () => {
    expect(bloqueoCancelarVisita({ ...base, estado: "REALIZADA", hoja })).toBeNull();
    expect(bloqueoCancelarVisita({ ...base, estado: "NO_REALIZADA" })).toBeNull();
  });

  it("una visita ya cancelada no se cancela de nuevo, pero sí se puede eliminar si no tiene hoja", () => {
    expect(bloqueoCancelarVisita({ ...base, estado: "CANCELADA" })).toMatch(/ya está cancelada/);
    expect(bloqueoEliminarVisita({ ...base, estado: "CANCELADA" })).toBeNull();
  });

  it("con hoja de visita no se elimina (se propone cancelar)", () => {
    expect(bloqueoEliminarVisita({ ...base, estado: "REALIZADA", hoja })).toMatch(/Puede cancelarla/);
    expect(bloqueoEliminarVisita({ ...base, estado: "REALIZADA", hoja: { ...hoja, conceptoNumero: "0012" } })).toMatch(/N\.° 0012/);
  });

  it("con concepto enviado a firma no se cancela ni se elimina", () => {
    const enFirma = { ...base, estado: "REALIZADA", hoja: { ...hoja, conceptoNumero: "0012", finalizadaEn: new Date() } };
    expect(bloqueoCancelarVisita(enFirma)).toMatch(/firma/);
    expect(bloqueoEliminarVisita(enFirma)).toMatch(/firmas/);
    const conDocumento = { ...base, estado: "REALIZADA", hoja: { ...hoja, documentoConceptoId: "doc" } };
    expect(opcionesAnulacion(conDocumento)).toMatchObject({ cancelar: false, eliminar: false });
  });

  it("en un expediente archivado no se cancela ni se elimina", () => {
    expect(opcionesAnulacion({ ...base, expedienteArchivado: true })).toMatchObject({ cancelar: false, eliminar: false });
  });
});
