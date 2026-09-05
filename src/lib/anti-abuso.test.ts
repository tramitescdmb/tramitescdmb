import { describe, expect, it } from "vitest";
import { llenadoDemasiadoRapido, MIN_MS_LLENADO_FORMULARIO } from "./anti-abuso";

describe("llenadoDemasiadoRapido", () => {
  it("true si el formulario se envía casi al instante de cargar", () => {
    expect(llenadoDemasiadoRapido(Date.now())).toBe(true);
  });

  it("false si pasó más que el mínimo desde que cargó", () => {
    expect(llenadoDemasiadoRapido(Date.now() - MIN_MS_LLENADO_FORMULARIO - 1000)).toBe(false);
  });
});
