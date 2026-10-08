import { describe, expect, it } from "vitest";
import { camposFaltantes, leerDatosPersona, nombreCompletoPersona, personaVacia, REQUERIDOS_CONTRATISTA, separarNombreCompleto, TIPOS_IDENTIFICACION_USUARIO } from "./datos-persona";

describe("datos de persona", () => {
  it("separa el nombre completo en nombres y apellidos", () => {
    expect(separarNombreCompleto("Luis Alberto Lozano Camacho")).toEqual({ nombres: "Luis Alberto", apellidos: "Lozano Camacho" });
    expect(separarNombreCompleto("Juan Pérez Gómez")).toEqual({ nombres: "Juan", apellidos: "Pérez Gómez" });
    expect(separarNombreCompleto("Ana Ruiz")).toEqual({ nombres: "Ana", apellidos: "Ruiz" });
    expect(separarNombreCompleto("Walhal01")).toEqual({ nombres: "Walhal01", apellidos: "" });
  });

  it("arma el nombre según el tipo de persona", () => {
    expect(nombreCompletoPersona({ tipoPersona: "NATURAL", nombres: " Ana ", apellidos: "Ruiz", razonSocial: "X" })).toBe("Ana Ruiz");
    expect(nombreCompletoPersona({ tipoPersona: "JURIDICA", nombres: "Ana", apellidos: "Ruiz", razonSocial: "EME S.A.S." })).toBe("EME S.A.S.");
  });

  it("lista lo que falta para ser contratista; celular y teléfono no son obligatorios", () => {
    const completa = personaVacia({
      identificacion: "91234567",
      nombres: "Ana",
      apellidos: "Ruiz",
      email: "ana@ejemplo.com",
      direccion: "Calle 1",
      regimenTributario: "NO_RESPONSABLE_IVA",
    });
    expect(camposFaltantes(completa, REQUERIDOS_CONTRATISTA)).toEqual([]);
    expect(camposFaltantes({ ...completa, apellidos: "", direccion: "", ciudad: "" }, REQUERIDOS_CONTRATISTA)).toEqual([
      "nombres y apellidos",
      "dirección",
      "departamento y ciudad",
    ]);
    expect(camposFaltantes({ ...completa, tipoPersona: "JURIDICA", razonSocial: "" }, REQUERIDOS_CONTRATISTA)).toEqual(["razón social"]);
  });

  it("limpia lo que llega del cliente", () => {
    const p = leerDatosPersona(
      { tipoPersona: "JURIDICA", tipoIdentificacion: "pa", identificacion: " 900123 ", nombres: "No", razonSocial: " EME ", email: " TI@EME.CO ", regimenTributario: "INVENTADO", granContribuyente: "si" },
      TIPOS_IDENTIFICACION_USUARIO
    );
    expect(p.tipoIdentificacion).toBe("NIT");
    expect(p.identificacion).toBe("900123");
    expect(p.nombres).toBe("");
    expect(p.razonSocial).toBe("EME");
    expect(p.email).toBe("ti@eme.co");
    expect(p.regimenTributario).toBe("");
    expect(p.granContribuyente).toBe(false);
  });
});
