import { describe, expect, it } from "vitest";
import { puedeAccederTramite, puedeEditarTramite, puedeAccederSeccion, puedeVerNivelAccesoExpediente, type PermisosUsuario } from "./permisos";

const admin: PermisosUsuario = { esAdmin: true, tramites: new Map(), secciones: new Set(), correspondencia: null, dependenciaId: null, puedeFirmar: true };
const sinAcceso: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: null, dependenciaId: null, puedeFirmar: false };
const conAcceso: PermisosUsuario = {
  esAdmin: false,
  tramites: new Map([
    ["t1", "EDITAR"],
    ["t2", "VER"],
  ]),
  secciones: new Set(["VITAL_BASE", "SINCA_BASE"]),
  correspondencia: null,
  dependenciaId: null,
  puedeFirmar: false,
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

describe("puedeAccederSeccion", () => {
  it("el ADMIN accede a cualquier sección de VITAL/SINCA 1.0", () => {
    expect(puedeAccederSeccion(admin, "SINCA_MINERIA")).toBe(true);
  });

  it("un FUNCIONARIO sin nada configurado no ve ninguna sección (denegado por defecto)", () => {
    expect(puedeAccederSeccion(sinAcceso, "VITAL_BASE")).toBe(false);
  });

  it("con la sección marcada, puede entrar; sin marcar (ej. Minería de datos), no", () => {
    expect(puedeAccederSeccion(conAcceso, "VITAL_BASE")).toBe(true);
    expect(puedeAccederSeccion(conAcceso, "SINCA_BASE")).toBe(true);
    expect(puedeAccederSeccion(conAcceso, "SINCA_MINERIA")).toBe(false);
  });
});

describe("puedeVerNivelAccesoExpediente", () => {
  const funcionarioDepA: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: "depA", puedeFirmar: true };
  const funcionarioDepB: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: "depB", puedeFirmar: true };
  const sinDependencia: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: null, puedeFirmar: true };
  const adminArchivo: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "ADMIN_ARCHIVO", dependenciaId: null, puedeFirmar: true };

  it("una PUBLICA la ve cualquiera con acceso a correspondencia, sin importar la dependencia", () => {
    expect(puedeVerNivelAccesoExpediente(funcionarioDepB, { nivelAcceso: "PUBLICA", dependenciaId: "depA" })).toBe(true);
  });

  it("sin ningún rol de correspondencia, ni siquiera una PUBLICA se ve (denegado por defecto)", () => {
    expect(puedeVerNivelAccesoExpediente(sinAcceso, { nivelAcceso: "PUBLICA", dependenciaId: "depA" })).toBe(false);
  });

  it("una CLASIFICADA/RESERVADA solo la ve quien pertenece a esa dependencia", () => {
    expect(puedeVerNivelAccesoExpediente(funcionarioDepA, { nivelAcceso: "CLASIFICADA", dependenciaId: "depA" })).toBe(true);
    expect(puedeVerNivelAccesoExpediente(funcionarioDepB, { nivelAcceso: "CLASIFICADA", dependenciaId: "depA" })).toBe(false);
    expect(puedeVerNivelAccesoExpediente(funcionarioDepB, { nivelAcceso: "RESERVADA", dependenciaId: "depA" })).toBe(false);
  });

  it("un funcionario sin dependencia asignada no ve ninguna CLASIFICADA/RESERVADA ajena", () => {
    expect(puedeVerNivelAccesoExpediente(sinDependencia, { nivelAcceso: "RESERVADA", dependenciaId: "depA" })).toBe(false);
  });

  it("ADMIN_ARCHIVO y el admin general ven cualquier nivel, de cualquier dependencia", () => {
    expect(puedeVerNivelAccesoExpediente(adminArchivo, { nivelAcceso: "RESERVADA", dependenciaId: "depA" })).toBe(true);
    expect(puedeVerNivelAccesoExpediente(admin, { nivelAcceso: "RESERVADA", dependenciaId: "depA" })).toBe(true);
  });
});
