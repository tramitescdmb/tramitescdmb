import { describe, expect, it } from "vitest";
import {
  vigenciaDeExpediente,
  validarFormatoSecop,
  validarOrdenFechasContrato,
  faltantesContratistaMinimo,
  faltantesRepresentanteLegal,
  leerRepresentanteLegal,
} from "./contratacion";
import { personaVacia } from "./datos-persona";

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

describe("faltantesContratistaMinimo", () => {
  it("persona natural exige documento, nombres y apellidos, teléfono y celular", () => {
    expect(faltantesContratistaMinimo(personaVacia())).toEqual(
      expect.arrayContaining(["documento de identificación", "nombres y apellidos", "teléfono", "celular"])
    );
  });

  it("persona natural completa no tiene faltantes", () => {
    expect(
      faltantesContratistaMinimo(
        personaVacia({ identificacion: "123", nombres: "Ana", apellidos: "Ruiz", telefono: "6071234567", celular: "3001234567" })
      )
    ).toEqual([]);
  });

  it("persona jurídica solo exige NIT y razón social (no teléfono/celular propios: los trae el representante legal)", () => {
    expect(faltantesContratistaMinimo(personaVacia({ tipoPersona: "JURIDICA" }))).toEqual(
      expect.arrayContaining(["NIT", "razón social"])
    );
    expect(faltantesContratistaMinimo(personaVacia({ tipoPersona: "JURIDICA" }))).not.toEqual(expect.arrayContaining(["teléfono"]));
    expect(faltantesContratistaMinimo(personaVacia({ tipoPersona: "JURIDICA", identificacion: "900123456", razonSocial: "Acme S.A.S." }))).toEqual(
      []
    );
  });
});

describe("leerRepresentanteLegal / faltantesRepresentanteLegal", () => {
  it("exige cédula, nombres y apellidos, dirección, y teléfono o celular", () => {
    expect(faltantesRepresentanteLegal(leerRepresentanteLegal({}))).toEqual([
      "cédula del representante legal",
      "nombres y apellidos del representante legal",
      "dirección del representante legal",
      "teléfono o celular del representante legal",
    ]);
  });

  it("con solo celular (sin teléfono fijo) ya no falta nada de contacto", () => {
    const r = leerRepresentanteLegal({ nombres: "Luis", apellidos: "Pérez", identificacion: "123", direccion: "Calle 1", celular: "3000000000" });
    expect(faltantesRepresentanteLegal(r)).toEqual([]);
  });

  it("recorta y descarta valores que no son texto", () => {
    expect(leerRepresentanteLegal({ nombres: "  Luis  ", identificacion: 123, apellidos: null })).toEqual({
      nombres: "Luis",
      apellidos: "",
      identificacion: "",
      direccion: "",
      telefono: "",
      celular: "",
    });
  });
});
