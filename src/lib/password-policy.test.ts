import { describe, expect, it } from "vitest";
import { validarPoliticaPassword, estadoVigenciaPassword, type PoliticaPassword } from "./password-policy";

const POLITICA_BASE: PoliticaPassword = {
  passwordLongitudMinima: 8,
  passwordLongitudMaxima: 72,
  passwordRequiereMayuscula: false,
  passwordRequiereNumero: false,
  passwordRequiereEspecial: false,
  passwordHistorialCantidad: 0,
  passwordVigenciaDias: null,
};

describe("validarPoliticaPassword", () => {
  it("acepta una contraseña que cumple una política sin exigencias extra", () => {
    expect(validarPoliticaPassword("unaClaveRazonable", POLITICA_BASE)).toBeNull();
  });

  it("rechaza una contraseña más corta que el mínimo", () => {
    expect(validarPoliticaPassword("abc123", POLITICA_BASE)).toMatch(/al menos 8 caracteres/);
  });

  it("rechaza una contraseña más larga que el máximo", () => {
    const politica = { ...POLITICA_BASE, passwordLongitudMaxima: 10 };
    expect(validarPoliticaPassword("estoTieneMasDeDiezCaracteres", politica)).toMatch(/no puede tener más de 10/);
  });

  it("exige mayúscula cuando la política lo pide", () => {
    const politica = { ...POLITICA_BASE, passwordRequiereMayuscula: true };
    expect(validarPoliticaPassword("sinmayuscula1", politica)).toMatch(/mayúscula/);
    expect(validarPoliticaPassword("conMayuscula1", politica)).toBeNull();
  });

  it("exige número cuando la política lo pide", () => {
    const politica = { ...POLITICA_BASE, passwordRequiereNumero: true };
    expect(validarPoliticaPassword("SinNumeros", politica)).toMatch(/número/);
    expect(validarPoliticaPassword("ConNumero1", politica)).toBeNull();
  });

  it("exige carácter especial cuando la política lo pide", () => {
    const politica = { ...POLITICA_BASE, passwordRequiereEspecial: true };
    expect(validarPoliticaPassword("SinEspecial1", politica)).toMatch(/especial/);
    expect(validarPoliticaPassword("ConEspecial1!", politica)).toBeNull();
  });

  it("rechaza contraseñas del diccionario de débiles sin importar la configuración", () => {
    expect(validarPoliticaPassword("12345678", POLITICA_BASE)).toMatch(/común o predecible/);
    expect(validarPoliticaPassword("cdmb2025", POLITICA_BASE)).toMatch(/común o predecible/);
  });

  it("rechaza secuencias de un solo dígito repetido", () => {
    expect(validarPoliticaPassword("11111111", POLITICA_BASE)).toMatch(/común o predecible/);
  });
});

describe("estadoVigenciaPassword", () => {
  it("nunca vence si la política no define vigencia", () => {
    expect(estadoVigenciaPassword(new Date("2020-01-01"), null)).toEqual({ vencida: false, diasRestantes: null });
  });

  it("nunca vence si no se conoce cuándo se fijó la contraseña", () => {
    expect(estadoVigenciaPassword(null, 90)).toEqual({ vencida: false, diasRestantes: null });
  });

  it("no está vencida si falta tiempo dentro de la vigencia", () => {
    const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const r = estadoVigenciaPassword(haceUnDia, 90);
    expect(r.vencida).toBe(false);
    expect(r.diasRestantes).toBeGreaterThan(80);
  });

  it("está vencida si ya pasó la vigencia configurada", () => {
    const hace100Dias = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const r = estadoVigenciaPassword(hace100Dias, 90);
    expect(r.vencida).toBe(true);
    expect(r.diasRestantes).toBeLessThanOrEqual(0);
  });
});
