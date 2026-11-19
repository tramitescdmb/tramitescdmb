import { describe, expect, it } from "vitest";
import { formatearNumeroTramite, maximoMemorandos, numeroFinal, validarSiguiente } from "@/lib/consecutivos";

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

describe("consecutivos de memorandos", () => {
  it("toma el número guardado y, en los anteriores al módulo, su orden de radicación", () => {
    const guardado = (consecutivo: number) => ({ datosMemorando: { version: 1, consecutivo, numero: `ADEI – ${consecutivo} /2026`, ciudad: "Bucaramanga", para: { nombre: "A", cargo: "B" }, de: { nombre: "C", cargo: "D" }, proyecto: null, reviso: null, oficina: "x" } });
    expect(maximoMemorandos([])).toEqual({ maximo: 0, registros: 0 });
    expect(maximoMemorandos([{ datosMemorando: null }, { datosMemorando: null }, guardado(3)])).toEqual({ maximo: 3, registros: 3 });
    expect(maximoMemorandos([{ datosMemorando: null }, guardado(54)])).toEqual({ maximo: 54, registros: 2 });
  });
});
