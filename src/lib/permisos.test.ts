import { describe, expect, it } from "vitest";
import { puedeAccederTramite, puedeEditarTramite, type PermisosUsuario } from "./permisos";

const admin: PermisosUsuario = { esAdmin: true, tramites: new Map() };
const sinAcceso: PermisosUsuario = { esAdmin: false, tramites: new Map() };
const conAcceso: PermisosUsuario = {
  esAdmin: false,
  tramites: new Map([
    ["t1", "EDITAR"],
    ["t2", "VER"],
  ]),
};

describe("puedeAccederTramite", () => {
  it("el ADMIN accede a cualquier trámite", () => {
    expect(puedeAccederTramite(admin, "cualquiera")).toBe(true);
  });

  it("un FUNCIONARIO sin nada configurado NO ve ningún trámite (denegado por defecto)", () => {
    expect(puedeAccederTramite(sinAcceso, "cualquiera")).toBe(false);
  });

  it("con VER o EDITAR configurado, puede ver el trámite", () => {
    expect(puedeAccederTramite(conAcceso, "t1")).toBe(true);
    expect(puedeAccederTramite(conAcceso, "t2")).toBe(true);
    expect(puedeAccederTramite(conAcceso, "t3")).toBe(false);
  });
});

describe("puedeEditarTramite", () => {
  it("el ADMIN puede editar cualquier trámite", () => {
    expect(puedeEditarTramite(admin, "cualquiera")).toBe(true);
  });

  it("un FUNCIONARIO sin nada configurado no puede editar", () => {
    expect(puedeEditarTramite(sinAcceso, "cualquiera")).toBe(false);
  });

  it("con nivel EDITAR, puede editar; con VER, solo puede ver (no editar)", () => {
    expect(puedeEditarTramite(conAcceso, "t1")).toBe(true);
    expect(puedeEditarTramite(conAcceso, "t2")).toBe(false);
  });
});
