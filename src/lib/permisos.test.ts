import { describe, expect, it } from "vitest";
import { puedeAccederTramite, type PermisosUsuario } from "./permisos";

const admin: PermisosUsuario = { esAdmin: true, tramiteIds: null };
const sinRol: PermisosUsuario = { esAdmin: false, tramiteIds: null };
const restringido: PermisosUsuario = { esAdmin: false, tramiteIds: new Set(["t1", "t2"]) };

describe("puedeAccederTramite", () => {
  it("el ADMIN accede a cualquier trámite", () => {
    expect(puedeAccederTramite(admin, "cualquiera")).toBe(true);
  });

  it("un usuario sin Rol de acceso asignado no tiene restricción (compatibilidad)", () => {
    expect(puedeAccederTramite(sinRol, "cualquiera")).toBe(true);
  });

  it("un Rol restringido a trámites específicos solo permite los marcados", () => {
    expect(puedeAccederTramite(restringido, "t1")).toBe(true);
    expect(puedeAccederTramite(restringido, "t3")).toBe(false);
  });
});
