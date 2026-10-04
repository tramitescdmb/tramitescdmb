import { describe, expect, it } from "vitest";
import { codigoVerificacion, parsearCodigoVerificacion } from "./validar-firma";

describe("código seguro de verificación", () => {
  it("agrupa el identificador y se puede leer de vuelta", () => {
    const csv = codigoVerificacion("G", "cmue2rycs0003kz04ze47iuhb");
    expect(csv).toBe("G-CMUE2-RYCS0-003KZ-04ZE4-7IUHB");
    expect(parsearCodigoVerificacion(csv)).toEqual({ tipo: "G", id: "cmue2rycs0003kz04ze47iuhb" });
    expect(parsearCodigoVerificacion(" g cmue2 rycs0 003kz 04ze4 7iuhb ")).toEqual({ tipo: "G", id: "cmue2rycs0003kz04ze47iuhb" });
  });

  it("rechaza códigos mal formados", () => {
    expect(parsearCodigoVerificacion("X-CMUE2-RYCS0-003KZ-04ZE4-7IUHB")).toBeNull();
    expect(parsearCodigoVerificacion("G-123")).toBeNull();
  });
});
