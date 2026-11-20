import { describe, expect, it } from "vitest";
import { estadoTrasRespuesta, interpretarPlazo, plazoPorDefecto, validarItems } from "@/lib/correccion-solicitud";

describe("devolución para corrección", () => {
  const ahora = new Date("2026-11-20T15:00:00Z");

  it("sugiere un mes de plazo", () => {
    expect(plazoPorDefecto(ahora)).toBe("2026-12-20");
  });

  it("acepta plazos futuros de hasta tres meses", () => {
    expect(interpretarPlazo("2026-12-20", ahora)?.toISOString()).toBe("2026-12-21T04:59:59.000Z");
    expect(interpretarPlazo("2026-11-19", ahora)).toBeNull();
    expect(interpretarPlazo("2027-06-01", ahora)).toBeNull();
    expect(interpretarPlazo("20-12-2026", ahora)).toBeNull();
  });

  it("exige motivo y no repite documentos", () => {
    expect(validarItems([]).ok).toBe(false);
    expect(validarItems([{ documentoId: "a", motivo: "no" }]).ok).toBe(false);
    expect(validarItems([{ documentoId: "a", motivo: "Ilegible" }, { documentoId: "a", motivo: "Ilegible" }]).ok).toBe(false);
    expect(validarItems([{ motivo: "Falta el plano" }]).ok).toBe(false);
    const r = validarItems([{ documentoId: "a", motivo: "Está ilegible" }, { titulo: "Plano del predio", motivo: "Aporte el plano firmado" }]);
    expect(r.ok && r.items).toEqual([
      { documentoId: "a", requisitoId: null, titulo: null, motivo: "Está ilegible" },
      { documentoId: null, requisitoId: null, titulo: "Plano del predio", motivo: "Aporte el plano firmado" },
    ]);
  });

  it("al responder vuelve a radicada o a en trámite", () => {
    expect(estadoTrasRespuesta("RADICADO")).toBe("RADICADO");
    expect(estadoTrasRespuesta("EN_TRAMITE")).toBe("EN_TRAMITE");
    expect(estadoTrasRespuesta("SUSPENDIDO")).toBe("EN_TRAMITE");
  });
});
