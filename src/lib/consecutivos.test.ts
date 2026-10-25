import { describe, expect, it } from "vitest";
import { formatearNumeroTramite, numeroFinal, validarSiguiente } from "@/lib/consecutivos";

describe("consecutivos", () => {
  it("lee el número de cada formato", () => {
    expect(numeroFinal("M-DA-PR39-2026-0012", "M-DA-PR39-2026-")).toBe(12);
    expect(numeroFinal("EV-0207-2026", "EV-", "-2026")).toBe(207);
    expect(numeroFinal("CDMB-CTO-2026-000003", "CDMB-CTO-2026-")).toBe(3);
    expect(numeroFinal("M-DA-PR39-2025-0012", "M-DA-PR39-2026-")).toBeNull();
    expect(numeroFinal("M-DA-PR39-2026-00A2", "M-DA-PR39-2026-")).toBeNull();
  });

  it("formatea el número de expediente de trámite", () => {
    expect(formatearNumeroTramite("M-DA-PR41", 2027, 1)).toBe("M-DA-PR41-2027-0001");
  });

  it("no deja reutilizar números ya usados", () => {
    expect(validarSiguiente(1, 0)).toBeNull();
    expect(validarSiguiente(5, 5)).toMatch(/debe ser 6 o mayor/);
    expect(validarSiguiente(0, 0)).toMatch(/entre 1 y/);
    expect(validarSiguiente(208, 207)).toBeNull();
  });
});
