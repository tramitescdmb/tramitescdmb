import { describe, expect, it } from "vitest";
import { proponerSeparacion } from "@/lib/negocios-verdes-correos";

describe("Separar dos correos en correo y correo secundario", () => {
  it("separa con coma, punto y coma, barra, espacio o «y»", () => {
    for (const texto of ["a@x.com, b@y.com", "a@x.com;b@y.com", "a@x.com / b@y.com", "a@x.com  b@y.com", "a@x.com y b@y.com", "a@x.com - b@y.com", "a@x.com|b@y.com"]) {
      expect(proponerSeparacion(texto, null)).toEqual({ accion: "separar", email: "a@x.com", emailSecundario: "b@y.com", avisos: [] });
    }
  });

  it("quita mailto:, paréntesis y puntos finales", () => {
    expect(proponerSeparacion("(a@x.com), mailto:b@y.com.", null)).toMatchObject({ accion: "separar", email: "a@x.com", emailSecundario: "b@y.com" });
  });

  it("no toca lo que no tiene dos correos", () => {
    expect(proponerSeparacion("a@x.com", null)).toMatchObject({ accion: "omitir" });
    expect(proponerSeparacion(null, null)).toMatchObject({ accion: "omitir" });
  });

  it("deja para revisión a mano lo que no se puede separar sin perder datos", () => {
    expect(proponerSeparacion("a@x.comb@y.com", null)).toMatchObject({ accion: "omitir", motivo: expect.stringMatching(/pegados/) });
    expect(proponerSeparacion("a@x.com, b@y.com, c@z.com", null)).toMatchObject({ accion: "omitir", motivo: expect.stringMatching(/3 correos/) });
    expect(proponerSeparacion("a@x.com (gerencia) b@y.com (ventas)", null)).toMatchObject({ accion: "omitir", motivo: expect.stringMatching(/gerencia ventas/) });
    expect(proponerSeparacion("a@x.com, b@y.com", "c@z.com")).toMatchObject({ accion: "omitir", motivo: expect.stringMatching(/c@z\.com/) });
  });

  it("si el secundario ya es el segundo correo, o los dos son iguales, solo limpia el principal", () => {
    expect(proponerSeparacion("a@x.com, B@y.com", "b@y.com")).toMatchObject({ accion: "separar", email: "a@x.com", emailSecundario: "b@y.com" });
    expect(proponerSeparacion("a@x.com, A@x.com", null)).toEqual({ accion: "separar", email: "a@x.com", emailSecundario: null, avisos: [] });
  });

  it("separa aunque un correo esté mal escrito, y lo avisa", () => {
    const r = proponerSeparacion("a@gmailcom, b@y.com", null);
    expect(r).toMatchObject({ accion: "separar", email: "a@gmailcom", emailSecundario: "b@y.com" });
    expect(r.accion === "separar" && r.avisos.join(" ")).toMatch(/gmail\.com/);
  });
});
