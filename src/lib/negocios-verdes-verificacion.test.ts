import { describe, expect, it } from "vitest";
import { problemaCorreo, repartirCorreos, separarCorreos } from "@/lib/negocios-verdes-verificacion";

describe("Correo secundario de Negocios Verdes", () => {
  it("separa dos correos escritos en un mismo campo", () => {
    expect(separarCorreos("a@x.com / b@y.com")).toEqual(["a@x.com", "b@y.com"]);
    expect(separarCorreos("a@x.com; b@y.com")).toEqual(["a@x.com", "b@y.com"]);
    expect(separarCorreos("a@x.com y b@y.com")).toEqual(["a@x.com", "b@y.com"]);
    expect(separarCorreos("(a@x.com) - <b@y.com>.")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("pasa el segundo correo al campo secundario cuando está vacío", () => {
    expect(repartirCorreos("a@x.com, b@y.com", null)).toEqual({ principal: "a@x.com", secundario: "b@y.com" });
    expect(repartirCorreos("a@x.com / b@y.com", "")).toEqual({ principal: "a@x.com", secundario: "b@y.com" });
  });

  it("no toca lo que ya está separado, ni tres correos, ni un solo correo", () => {
    expect(repartirCorreos("a@x.com", "b@y.com")).toEqual({ principal: "a@x.com", secundario: "b@y.com" });
    expect(repartirCorreos("a@x.com, b@y.com", "c@z.com")).toEqual({ principal: "a@x.com, b@y.com", secundario: "c@z.com" });
    expect(repartirCorreos("a@x.com b@y.com c@z.com", null)).toEqual({ principal: "a@x.com b@y.com c@z.com", secundario: null });
    expect(repartirCorreos("  a@x.com ", null)).toEqual({ principal: "a@x.com", secundario: null });
    expect(repartirCorreos("", "")).toEqual({ principal: null, secundario: null });
  });

  it("el verificador remite al campo secundario cuando hay dos correos", () => {
    expect(problemaCorreo("a@x.com b@y.com")).toMatch(/correo secundario/);
    expect(problemaCorreo("a@x.com")).toBeNull();
  });
});
