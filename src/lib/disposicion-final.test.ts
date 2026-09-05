import { describe, expect, it } from "vitest";
import { sumarAnios, calcularFaseArchivistica } from "./disposicion-final";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("sumarAnios", () => {
  it("suma años calendario simples", () => {
    expect(sumarAnios(d("2020-03-15"), 5).toISOString().slice(0, 10)).toBe("2025-03-15");
  });

  it("cero años no cambia la fecha", () => {
    expect(sumarAnios(d("2020-03-15"), 0).toISOString().slice(0, 10)).toBe("2020-03-15");
  });
});

describe("calcularFaseArchivistica", () => {
  const radicacion = d("2020-01-01");

  it("en gestión mientras no se cumplan los años de gestión", () => {
    const ahora = d("2022-01-01"); // 2 de 3 años de gestión
    const r = calcularFaseArchivistica(radicacion, 3, 2, ahora);
    expect(r.fase).toBe("GESTION");
    expect(r.fechaFinGestion.toISOString().slice(0, 10)).toBe("2023-01-01");
    expect(r.fechaFinCentral.toISOString().slice(0, 10)).toBe("2025-01-01");
  });

  it("pendiente de transferir cuando ya pasó gestión pero no central", () => {
    const ahora = d("2024-01-01"); // pasó gestión (2023), no ha pasado central (2025)
    const r = calcularFaseArchivistica(radicacion, 3, 2, ahora);
    expect(r.fase).toBe("TRANSFERENCIA_PENDIENTE");
  });

  it("pendiente de disposición final cuando ya pasaron ambos plazos", () => {
    const ahora = d("2026-01-02");
    const r = calcularFaseArchivistica(radicacion, 3, 2, ahora);
    expect(r.fase).toBe("DISPOSICION_PENDIENTE");
  });

  it("con cero años de retención, la disposición queda pendiente desde el día de radicación", () => {
    const r = calcularFaseArchivistica(radicacion, 0, 0, radicacion);
    expect(r.fase).toBe("DISPOSICION_PENDIENTE");
  });
});
