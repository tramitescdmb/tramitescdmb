import { describe, expect, it } from "vitest";
import { RUTAS_DASHBOARD, esRutaDashboard, itemActivo } from "./menu";

const dashboard = { href: "/", prefijo: RUTAS_DASHBOARD };

describe("entrada única Dashboard del menú", () => {
  it("queda activa en Mi trabajo y en el Dashboard general", () => {
    expect(itemActivo(dashboard, "/")).toBe(true);
    expect(itemActivo(dashboard, "/dashboard")).toBe(true);
  });

  it("no se activa en las páginas de los módulos", () => {
    for (const ruta of ["/tramites-ambientales", "/contratacion/panel", "/correspondencia/panel", "/vital", "/historico/solicitudes", "/usuarios"]) {
      expect(itemActivo(dashboard, ruta)).toBe(false);
    }
  });

  it("reconoce las rutas del dashboard para la miga de pan", () => {
    expect(esRutaDashboard("/")).toBe(true);
    expect(esRutaDashboard("/dashboard")).toBe(true);
    expect(esRutaDashboard("/contratacion/dashboard")).toBe(false);
    expect(esRutaDashboard("/dashboards")).toBe(false);
  });
});

describe("entradas de módulo", () => {
  it("usan sus prefijos", () => {
    const gecon = { href: "/contratacion/panel", prefijo: "/contratacion" };
    expect(itemActivo(gecon, "/contratacion/expedientes/5")).toBe(true);
    expect(itemActivo(gecon, "/contratacionx")).toBe(false);
  });
});
