import { describe, expect, it } from "vitest";
import { calcularVentanaSesion } from "./auth";

const MINUTO = 60;
const DIA = 60 * 60 * 24;
const INACTIVIDAD_SEGUNDOS = 30 * MINUTO;
const TOPE_ABSOLUTO_SEGUNDOS = 7 * DIA;

describe("calcularVentanaSesion", () => {
  it("recién iniciada, la ventana es la de inactividad completa", () => {
    const r = calcularVentanaSesion(1000, 1000);
    expect(r).toEqual({ valida: true, maxAge: INACTIVIDAD_SEGUNDOS });
  });

  it("con actividad reciente dentro de la ventana, sigue válida con la ventana completa", () => {
    const loginAt = 1000;
    const ahora = loginAt + 5 * MINUTO;
    const r = calcularVentanaSesion(loginAt, ahora);
    expect(r.valida).toBe(true);
    expect(r.maxAge).toBe(INACTIVIDAD_SEGUNDOS);
  });

  it("al acercarse al tope absoluto de 7 días, la ventana se recorta para no pasarlo", () => {
    const loginAt = 1000;
    const ahora = loginAt + TOPE_ABSOLUTO_SEGUNDOS - 10; // faltan 10s para el tope
    const r = calcularVentanaSesion(loginAt, ahora);
    expect(r.valida).toBe(true);
    expect(r.maxAge).toBe(10);
  });

  it("pasado el tope absoluto de 7 días, la sesión ya no es válida aunque haya actividad", () => {
    const loginAt = 1000;
    const ahora = loginAt + TOPE_ABSOLUTO_SEGUNDOS;
    const r = calcularVentanaSesion(loginAt, ahora);
    expect(r).toEqual({ valida: false, maxAge: 0 });
  });
});
