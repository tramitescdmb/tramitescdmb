import { describe, expect, it } from "vitest";
import { destinoTrasIngreso } from "./destino-login";

describe("destinoTrasIngreso", () => {
  it("conserva rutas internas, también descargas por GET", () => {
    expect(destinoTrasIngreso("/contratacion/panel")).toBe("/contratacion/panel");
    expect(destinoTrasIngreso("/api/contratacion-documentos/abc")).toBe("/api/contratacion-documentos/abc");
  });

  it("nunca vuelve a las rutas de sesión (evita el 405 de /api/auth/logout)", () => {
    expect(destinoTrasIngreso("/api/auth/logout")).toBe("/");
    expect(destinoTrasIngreso("/api/auth/login")).toBe("/");
    expect(destinoTrasIngreso("/login?next=/x")).toBe("/");
  });

  it("rechaza destinos externos o vacíos", () => {
    expect(destinoTrasIngreso("https://otro.sitio")).toBe("/");
    expect(destinoTrasIngreso("//otro.sitio")).toBe("/");
    expect(destinoTrasIngreso(null)).toBe("/");
    expect(destinoTrasIngreso("")).toBe("/");
  });
});
