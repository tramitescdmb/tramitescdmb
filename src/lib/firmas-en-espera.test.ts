import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { esSuTurno, interesadosEnFirma, turnoDesde, diasDesde } = await import("@/lib/firmas-en-espera");

const d = (s: string) => new Date(s);

describe("firmas en espera", () => {
  const principal = { rol: "FIRMA" as const, orden: 1, estado: "COMPLETADA" as const, completadoEn: d("2026-11-20T15:00:00Z"), usuarioAsignadoId: "luiloz01" };
  const proyecto = { rol: "FIRMA" as const, orden: 5, estado: "PENDIENTE" as const, completadoEn: null, usuarioAsignadoId: "walhal01", asignadoPorId: "luiloz01", asignadoEn: d("2026-11-18T10:00:00Z") };

  it("el turno empieza cuando firma el turno anterior, no al asignar", () => {
    expect(turnoDesde(proyecto, [principal, proyecto])).toEqual(d("2026-11-20T15:00:00Z"));
    expect(diasDesde(turnoDesde(proyecto, [principal, proyecto]), d("2026-11-23T16:00:00Z"))).toBe(3);
  });

  it("no es su turno mientras un firmante anterior siga pendiente", () => {
    expect(esSuTurno(proyecto, [{ ...principal, estado: "PENDIENTE" }, proyecto])).toBe(false);
    expect(esSuTurno(proyecto, [principal, proyecto])).toBe(true);
  });

  it("avisa a quien solicitó y a quienes ya firmaron, nunca al pendiente", () => {
    expect(interesadosEnFirma({ ...proyecto, asignadoPorId: "admin" }, [principal, proyecto]).sort()).toEqual(["admin", "luiloz01"]);
    expect(interesadosEnFirma({ ...proyecto, asignadoPorId: "walhal01" }, [proyecto])).toEqual([]);
    expect(interesadosEnFirma(proyecto, [{ ...principal, rol: "LECTURA" as const }, proyecto])).toEqual(["luiloz01"]);
  });
});
