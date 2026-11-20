import { describe, expect, it } from "vitest";
import { calcularAvance, pasosParaAvance } from "./ProgresoExpediente";

describe("avance del expediente", () => {
  const titulos = ["RECIBIR", "AUTO", "VISITA", "RESOLUCIÓN", "NOTIFICAR AL USUARIO", "REALIZAR SEGUIMIENTO"];

  it("cuenta todos los pasos, también el de seguimiento", () => {
    expect(pasosParaAvance(titulos)).toBe(6);
    expect(pasosParaAvance(["A", "B", "NOTIFICAR"])).toBe(3);
  });

  it("aprobado a mitad del flujo no marca 100%", () => {
    expect(calcularAvance(3, 6, "APROBADO", 5).pct).toBe(40);
  });

  it("sin finalizar nunca marca 100%, ni en el último paso", () => {
    expect(calcularAvance(6, 6, "APROBADO", 6, false).pct).toBe(83);
    expect(calcularAvance(6, 6, "EN_TRAMITE", 5).pct).toBe(99);
    expect(calcularAvance(5, 6, "EN_TRAMITE", 5).pct).toBe(80);
  });

  it("el primer paso sin completar es 0% y los cierres anticipados son 100%", () => {
    expect(calcularAvance(1, 6, "RADICADO", 5).pct).toBe(0);
    expect(calcularAvance(2, 6, "DESISTIDO", 5).pct).toBe(100);
  });

  it("concesión de aguas: aprobada en el paso 8 y en «Notificar al usuario» (9 de 10) va en 80%, no finalizada", () => {
    const r = calcularAvance(9, 10, "APROBADO", 10, false);
    expect(r.pct).toBe(80);
    expect(r.finalizado).toBe(false);
  });

  it("negado con notificación pendiente tampoco es 100%", () => {
    expect(calcularAvance(9, 10, "NEGADO", 10, false).pct).toBe(80);
  });

  it("al finalizar el último paso el avance es 100%", () => {
    const r = calcularAvance(10, 10, "APROBADO", 10, true);
    expect(r.pct).toBe(100);
    expect(r.completados).toBe(10);
  });
});
