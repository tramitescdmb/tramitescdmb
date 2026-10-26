import { describe, expect, it } from "vitest";
import { entidadFirmante } from "@/lib/entidad-firmante";

describe("firma a nombre de una persona jurídica", () => {
  it("una persona natural no lleva datos de entidad", () => {
    expect(entidadFirmante({ nombre: "Ana", contratista: { identificacion: "123", tipoPersona: "NATURAL" } })).toBeNull();
    expect(entidadFirmante({ nombre: "Funcionario" })).toBeNull();
  });

  it("usa la razón social, el NIT y el representante legal registrado", () => {
    expect(
      entidadFirmante({
        nombre: "Gonzalo Jaimes",
        contratista: {
          identificacion: "900123456-1",
          tipoPersona: "JURIDICA",
          nombreORazonSocial: "EME INGENIERIA SA BIC",
          representanteLegal: { nombres: "Gonzalo", apellidos: "Jaimes Muñoz", identificacion: "91234567" },
        },
      })
    ).toEqual({ razonSocial: "EME INGENIERIA SA BIC", nit: "900123456-1", representante: "Gonzalo Jaimes Muñoz", documentoRepresentante: "91234567" });
  });

  it("sin representante registrado, el firmante es el representante con su propio documento", () => {
    expect(
      entidadFirmante({
        nombre: "Gonzalo Jaimes",
        cedulaONit: "91234567",
        tipoIdentificacionFirma: "CC",
        contratista: { identificacion: "900123456-1", tipoPersona: "JURIDICA", nombreORazonSocial: "EME INGENIERIA SA BIC", representanteLegal: null },
      })
    ).toEqual({ razonSocial: "EME INGENIERIA SA BIC", nit: "900123456-1", representante: "Gonzalo Jaimes", documentoRepresentante: "91234567" });
  });
});
