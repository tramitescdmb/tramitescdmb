import { describe, expect, it } from "vitest";
import { nombreCompletoSolicitante } from "./solicitante";

describe("nombreCompletoSolicitante", () => {
  it("persona jurídica usa la razón social", () => {
    expect(
      nombreCompletoSolicitante({ tipo: "JURIDICA", razonSocial: "Acueducto Metropolitano S.A. E.S.P." })
    ).toBe("Acueducto Metropolitano S.A. E.S.P.");
  });

  it("persona jurídica sin razón social cae a nombres+apellidos (contacto/representante)", () => {
    expect(
      nombreCompletoSolicitante({ tipo: "JURIDICA", razonSocial: null, nombres: "Ana", apellidos: "Ríos" })
    ).toBe("Ana Ríos");
  });

  it("persona natural usa nombres + apellidos", () => {
    expect(nombreCompletoSolicitante({ tipo: "NATURAL", nombres: "Carlos", apellidos: "Gómez" })).toBe(
      "Carlos Gómez"
    );
  });

  it("persona natural sin nombres ni apellidos, sin razón social, muestra un guion largo", () => {
    expect(nombreCompletoSolicitante({ tipo: "NATURAL" })).toBe("—");
  });

  it("recorta espacios sobrantes de cada parte, sin dejar dobles espacios internos", () => {
    expect(nombreCompletoSolicitante({ tipo: "NATURAL", nombres: "  Luis  ", apellidos: " Pérez " })).toBe(
      "Luis Pérez"
    );
  });
});
