import { describe, expect, it } from "vitest";
import { salidaDeVencimiento } from "./flujos-vencimientos";
import { estadoTerminoPaso } from "./flujos";

const salidas = [{ etiqueta: "Aprobar" }, { etiqueta: "Escalar al jefe" }];

describe("vencimiento de pasos de flujo", () => {
  it("elige la salida configurada sin importar mayúsculas ni espacios", () => {
    expect(salidaDeVencimiento(salidas, " escalar al JEFE ")?.etiqueta).toBe("Escalar al jefe");
  });

  it("si la salida ya no existe o no se configuró, no avanza", () => {
    expect(salidaDeVencimiento(salidas, "Devolver")).toBeNull();
    expect(salidaDeVencimiento(salidas, null)).toBeNull();
  });

  it("el término se cuenta en días hábiles y respeta los festivos", () => {
    const desde = new Date("2026-10-28T15:00:00Z");
    const antes = estadoTerminoPaso(desde, 3, {}, new Date("2026-11-02T15:00:00Z"));
    const despues = estadoTerminoPaso(desde, 3, {}, new Date("2026-11-04T15:00:00Z"));
    expect(antes?.vencido).toBe(false);
    expect(despues?.vencido).toBe(true);
  });
});
