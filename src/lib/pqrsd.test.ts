import { describe, expect, it } from "vitest";
import { sumarDiasHabiles, diasHabilesEntre } from "./dias-habiles";
import { calcularVencimiento, calcularVencimientoTrasReactivar, estadoVencimiento, TERMINO_DIAS_HABILES } from "./pqrsd";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("calcularVencimiento", () => {
  it("aplica el término de 15 días hábiles a una petición general", () => {
    const radicacion = d("2025-01-02");
    expect(calcularVencimiento(radicacion, "PETICION_GENERAL").toISOString()).toBe(
      sumarDiasHabiles(radicacion, 15).toISOString()
    );
  });

  it("aplica el término de 10 días hábiles a una petición de documentos", () => {
    const radicacion = d("2025-01-02");
    expect(calcularVencimiento(radicacion, "PETICION_DOCUMENTOS").toISOString()).toBe(
      sumarDiasHabiles(radicacion, 10).toISOString()
    );
  });

  it("aplica el término de 30 días hábiles a una consulta", () => {
    const radicacion = d("2025-01-02");
    expect(calcularVencimiento(radicacion, "CONSULTA").toISOString()).toBe(
      sumarDiasHabiles(radicacion, 30).toISOString()
    );
  });

  it("todos los tipos tienen término configurado", () => {
    for (const tipo of Object.keys(TERMINO_DIAS_HABILES) as (keyof typeof TERMINO_DIAS_HABILES)[]) {
      expect(TERMINO_DIAS_HABILES[tipo]).toBeGreaterThan(0);
    }
  });
});

describe("calcularVencimientoTrasReactivar", () => {
  it("reanuda por los días hábiles que faltaban, no reinicia el término (Art. 17 CPACA)", () => {
    const radicacion = d("2025-01-02");
    const suspension = sumarDiasHabiles(radicacion, 5); // se consumieron 5 de 15
    const ahora = suspension; // se reactiva el mismo día que se levanta la suspensión
    const resultado = calcularVencimientoTrasReactivar(radicacion, suspension, ahora, 15);
    expect(resultado.toISOString()).toBe(sumarDiasHabiles(ahora, 10).toISOString()); // restan 10
  });

  it("no cuenta los días de la propia suspensión: reactivar más tarde no acorta lo que faltaba", () => {
    const radicacion = d("2025-01-02");
    const suspension = sumarDiasHabiles(radicacion, 5);
    const ahora = sumarDiasHabiles(suspension, 20); // la suspensión duró 20 días hábiles
    const resultado = calcularVencimientoTrasReactivar(radicacion, suspension, ahora, 15);
    expect(resultado.toISOString()).toBe(sumarDiasHabiles(ahora, 10).toISOString());
  });

  it("nunca da un término restante menor a 1 día (piso defensivo)", () => {
    const radicacion = d("2025-01-02");
    const suspension = sumarDiasHabiles(radicacion, 8); // ya se habían consumido más de los 5 del término
    const ahora = suspension;
    const resultado = calcularVencimientoTrasReactivar(radicacion, suspension, ahora, 5);
    expect(resultado.toISOString()).toBe(sumarDiasHabiles(ahora, 1).toISOString());
  });
});

describe("estadoVencimiento", () => {
  const ahora = d("2025-01-02");

  it("null si no hay fecha de vencimiento", () => {
    expect(estadoVencimiento(null, ahora)).toBeNull();
  });

  it("marca vencido si la fecha ya pasó", () => {
    const vencimiento = new Date(ahora.getTime() - 86_400_000);
    expect(estadoVencimiento(vencimiento, ahora)).toEqual({ texto: "Vencido", clase: "bg-red-50 text-red-700" });
  });

  it("marca próximo a vencer (ámbar) con 3 días hábiles o menos", () => {
    const vencimiento = sumarDiasHabiles(ahora, 2);
    const r = estadoVencimiento(vencimiento, ahora);
    expect(r?.texto).toBe("Vence en 2 d.h.");
    expect(r?.clase).toContain("amber");
  });

  it("estado neutro con más de 3 días hábiles restantes", () => {
    const vencimiento = sumarDiasHabiles(ahora, 5);
    const r = estadoVencimiento(vencimiento, ahora);
    expect(r?.texto).toBe("5 d.h. restantes");
    expect(r?.clase).not.toContain("amber");
    expect(r?.clase).not.toContain("red");
  });

  it("diasHabilesEntre(ahora, vencimiento) es exactamente lo que se le sumó (consistencia con dias-habiles)", () => {
    const vencimiento = sumarDiasHabiles(ahora, 7);
    expect(diasHabilesEntre(ahora, vencimiento)).toBe(7);
  });
});
