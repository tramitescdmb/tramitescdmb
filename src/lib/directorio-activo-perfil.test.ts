import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));

import { extraerPerfil } from "./directorio-activo";

describe("perfil del directorio activo", () => {
  it("toma atributos LDAP aunque vengan anidados o en arreglo", () => {
    expect(
      extraerPerfil({
        token: "1|abc",
        message: "ok",
        user: { givenName: ["Luis Alfonso"], sn: "Lozano Camacho", mail: "luiloz01@cdmb.gov.co", mobile: "3001234567", employeeID: "13743584" },
      })
    ).toEqual({ nombres: "Luis Alfonso", apellidos: "Lozano Camacho", email: "luiloz01@cdmb.gov.co", celular: "3001234567", documento: "13743584" });
  });

  it("sin datos de la persona devuelve un perfil vacío", () => {
    expect(extraerPerfil({ token: "1|abc", message: "Bienvenido" })).toEqual({});
  });

  it("descarta un correo que no lo es", () => {
    expect(extraerPerfil({ usuario: { email: "luiloz01" } })).toEqual({});
  });
});
