import { describe, expect, it } from "vitest";
import { firmantesDeParticipantes, participantesEfectivos, validarParticipantes } from "@/lib/participantes-visita";

const nombres = new Map([
  ["a", "Ana"],
  ["b", "Beto"],
  ["c", "Carla"],
]);

describe("participantes de la visita", () => {
  it("exige alguien que elabore y que todos estén activos", () => {
    const permitidos = new Set(["a", "b"]);
    expect(validarParticipantes([{ usuarioId: "a", rol: "REVISA_TECNICO" }], { permitidos, contratistas: new Set(), nombres })).toMatch(/Elabora/);
    expect(validarParticipantes([{ usuarioId: "c", rol: "ELABORA" }], { permitidos, contratistas: new Set(), nombres })).toMatch(/Carla no existe/);
    expect(validarParticipantes([{ usuarioId: "a", rol: "ELABORA" }, { usuarioId: "b", rol: "VISTO_BUENO" }], { permitidos, contratistas: new Set(), nombres })).toBeNull();
  });

  it("un contratista no puede aprobar", () => {
    const r = validarParticipantes(
      [
        { usuarioId: "a", rol: "ELABORA" },
        { usuarioId: "b", rol: "APRUEBA" },
      ],
      { permitidos: new Set(["a", "b"]), contratistas: new Set(["b"]), nombres }
    );
    expect(r).toMatch(/Beto es contratista/);
  });

  it("traduce los roles a firmas con su calidad", () => {
    const f = firmantesDeParticipantes(
      [
        { usuarioId: "a", rol: "ELABORA" },
        { usuarioId: "b", rol: "REVISA_JURIDICO" },
        { usuarioId: "c", rol: "VISTO_BUENO" },
      ],
      new Set()
    );
    expect(f).toEqual([
      { usuarioId: "a", rol: "FIRMA", calidad: "PRINCIPAL" },
      { usuarioId: "b", rol: "FIRMA", calidad: "REVISO" },
      { usuarioId: "c", rol: "VISTO_BUENO", calidad: null },
    ]);
    const conAprobador = firmantesDeParticipantes(
      [
        { usuarioId: "a", rol: "ELABORA" },
        { usuarioId: "b", rol: "APRUEBA" },
      ],
      new Set()
    );
    expect(conAprobador[0]).toEqual({ usuarioId: "a", rol: "FIRMA", calidad: "PROYECTO" });
    expect(firmantesDeParticipantes([{ usuarioId: "a", rol: "ELABORA" }], new Set(["a"]))[0]!.calidad).toBe("PROYECTO");
  });

  it("sin participantes guardados, el profesional elabora", () => {
    expect(participantesEfectivos([], "p")).toEqual([{ usuarioId: "p", rol: "ELABORA" }]);
  });
});
