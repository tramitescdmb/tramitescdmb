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

  it("toma dirección y dependencia con nombres típicos de AD", () => {
    expect(
      extraerPerfil({
        user: { streetAddress: "Calle 36 # 10-30", physicalDeliveryOfficeName: "Subdirección Ambiental" },
      })
    ).toEqual({ direccion: "Calle 36 # 10-30", dependencia: "Subdirección Ambiental" });
  });

  it("si solo viene el nombre completo, lo parte en nombres/apellidos (4 palabras: 2+2)", () => {
    expect(extraerPerfil({ user: { displayName: "Luis Alfonso Lozano Camacho" } })).toEqual({
      nombreCompleto: "Luis Alfonso Lozano Camacho",
      nombres: "Luis Alfonso",
      apellidos: "Lozano Camacho",
    });
  });

  it("nombre completo de 2 palabras se parte 1+1", () => {
    expect(extraerPerfil({ user: { displayName: "Ana Ruiz" } })).toEqual({
      nombreCompleto: "Ana Ruiz",
      nombres: "Ana",
      apellidos: "Ruiz",
    });
  });

  it("no parte el nombre completo si nombres/apellidos ya vinieron por separado", () => {
    expect(
      extraerPerfil({ user: { givenName: "Luis", sn: "Lozano", displayName: "Luis Alfonso Lozano Camacho" } })
    ).toEqual({ nombres: "Luis", apellidos: "Lozano", nombreCompleto: "Luis Alfonso Lozano Camacho" });
  });

  it("descarta el nombre completo si el directorio solo repite el usuario de red (una sola palabra)", () => {
    expect(extraerPerfil({ user: { displayName: "luiloz01" } }, "luiloz01")).toEqual({});
  });

  it("descarta cualquier campo que repita exactamente el usuario de red, sin importar mayúsculas", () => {
    expect(extraerPerfil({ user: { cn: "LUILOZ01" } }, "luiloz01")).toEqual({});
  });

  it("no descarta un nombre completo real solo porque el usuario de red aparece en otro campo", () => {
    expect(
      extraerPerfil({ user: { displayName: "Luis Alfonso Lozano Camacho", mail: "luiloz01@cdmb.gov.co" } }, "luiloz01")
    ).toEqual({
      nombreCompleto: "Luis Alfonso Lozano Camacho",
      nombres: "Luis Alfonso",
      apellidos: "Lozano Camacho",
      email: "luiloz01@cdmb.gov.co",
    });
  });

  it("sin usuario de red para comparar, no descarta nada por ese motivo", () => {
    expect(extraerPerfil({ user: { displayName: "Ana Ruiz" } })).toEqual({
      nombreCompleto: "Ana Ruiz",
      nombres: "Ana",
      apellidos: "Ruiz",
    });
  });
});
