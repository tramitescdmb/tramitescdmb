import { describe, expect, it } from "vitest";
import { vigenciaDeExpediente, validarFormatoSecop } from "./contratacion";

describe("vigenciaDeExpediente", () => {
  it("usa el año de la fecha de inicio cuando existe", () => {
    expect(vigenciaDeExpediente(new Date("2027-03-10"), new Date("2026-01-01"))).toBe(2027);
  });

  it("cae al año de creación cuando todavía no hay fecha de inicio (típico de Precontractual)", () => {
    expect(vigenciaDeExpediente(null, new Date("2026-09-29"))).toBe(2026);
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
