import { describe, expect, it } from "vitest";
import { vigenciaDeExpediente, validarFormatoSecop, validarOrdenFechasContrato } from "./contratacion";

describe("vigenciaDeExpediente", () => {
  it("usa el año de la fecha de inicio cuando existe", () => {
    expect(vigenciaDeExpediente(new Date("2027-03-10"), new Date("2026-01-01"))).toBe(2027);
  });

  it("cae al año de creación cuando todavía no hay fecha de inicio (típico de Precontractual)", () => {
    expect(vigenciaDeExpediente(null, new Date("2026-09-29"))).toBe(2026);
  });
});

describe("validarOrdenFechasContrato", () => {
  it("rechaza una suscripción posterior al inicio", () => {
    expect(() => validarOrdenFechasContrato(new Date("2026-05-01"), new Date("2026-04-01"))).toThrow();
  });

  it("acepta suscripción igual o anterior al inicio, o cuando falta alguna de las dos", () => {
    expect(() => validarOrdenFechasContrato(new Date("2026-04-01"), new Date("2026-04-01"))).not.toThrow();
    expect(() => validarOrdenFechasContrato(new Date("2026-03-01"), new Date("2026-04-01"))).not.toThrow();
    expect(() => validarOrdenFechasContrato(null, new Date("2026-04-01"))).not.toThrow();
    expect(() => validarOrdenFechasContrato(new Date("2026-03-01"), null)).not.toThrow();
  });
});

describe("validarFormatoSecop", () => {
  it("acepta números de proceso con letras, dígitos, puntos, guiones y barras", () => {
    expect(() => validarFormatoSecop("IPS-045-2026")).not.toThrow();
    expect(() => validarFormatoSecop("CO1.BDOS.1234567")).not.toThrow();
  });

  it("rechaza vacío, demasiado corto o caracteres no permitidos", () => {
    expect(() => validarFormatoSecop("")).toThrow();
    expect(() => validarFormatoSecop("AB")).toThrow();
    expect(() => validarFormatoSecop("proceso con espacios")).toThrow();
    expect(() => validarFormatoSecop("<script>")).toThrow();
  });
});
