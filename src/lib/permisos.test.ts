import { describe, expect, it } from "vitest";
import {
  puedeAccederTramite,
  puedeEditarTramite,
  puedeAccederSeccion,
  puedeVerNivelAccesoExpediente,
  puedeDistribuir,
  puedeDespachar,
  puedeRadicar,
  puedeResponderComoAsignado,
  puedeDevolverReparto,
  type PermisosUsuario,
} from "./permisos";

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

const perm = (correspondencia: PermisosUsuario["correspondencia"], extra: Partial<PermisosUsuario> = {}): PermisosUsuario => ({
  esAdmin: false,
  tramites: new Map(),
  secciones: new Set(),
  correspondencia,
  dependenciaId: null,
  puedeFirmar: false,
  ...extra,
});

describe("puedeDistribuir — la ventanilla (y archivo/admin como supervisión)", () => {
  it("la ventanilla, ADMIN_ARCHIVO y el admin reparten", () => {
    expect(puedeDistribuir(perm("OPERADOR_VENTANILLA"))).toBe(true);
    expect(puedeDistribuir(perm("ADMIN_ARCHIVO"))).toBe(true);
    expect(puedeDistribuir(admin)).toBe(true);
  });

  it("el jefe y el funcionario de dependencia NO reparten (reparto centralizado en ventanilla)", () => {
    expect(puedeDistribuir(perm("JEFE_DEPENDENCIA"))).toBe(false);
    expect(puedeDistribuir(perm("FUNCIONARIO_DEPENDENCIA"))).toBe(false);
  });
});

describe("puedeDevolverReparto — solo el funcionario al que se le repartió, nunca quien reparte", () => {
  it("el funcionario del reparto vigente puede devolver", () => {
    expect(puedeDevolverReparto(perm("FUNCIONARIO_DEPENDENCIA"), "u1", [{ usuarioId: "u1", dependenciaId: null }])).toBe(true);
    expect(puedeDevolverReparto(perm("JEFE_DEPENDENCIA", { dependenciaId: "depA" }), "u2", [{ usuarioId: null, dependenciaId: "depA" }])).toBe(true);
  });

  it("la ventanilla no devuelve (re-reparte), ni un ajeno al reparto", () => {
    expect(puedeDevolverReparto(perm("OPERADOR_VENTANILLA"), "u1", [{ usuarioId: "u1", dependenciaId: null }])).toBe(false);
    expect(puedeDevolverReparto(admin, "u1", [{ usuarioId: "u1", dependenciaId: null }])).toBe(false);
    expect(puedeDevolverReparto(perm("FUNCIONARIO_DEPENDENCIA"), "u9", [{ usuarioId: "u1", dependenciaId: null }])).toBe(false);
  });
});

describe("puedeDespachar — ventanilla de salida (= quien radica)", () => {
  it("lo hace el operador de ventanilla, el rol de archivo y el admin", () => {
    expect(puedeDespachar(perm("OPERADOR_VENTANILLA"))).toBe(true);
    expect(puedeDespachar(perm("ADMIN_ARCHIVO"))).toBe(true);
    expect(puedeDespachar(admin)).toBe(true);
    expect(puedeDespachar(perm("OPERADOR_VENTANILLA"))).toBe(puedeRadicar(perm("OPERADOR_VENTANILLA")));
  });

  it("no lo hace un funcionario de dependencia", () => {
    expect(puedeDespachar(perm("FUNCIONARIO_DEPENDENCIA"))).toBe(false);
  });
});

describe("puedeResponderComoAsignado — solo el/los funcionario(s) del reparto vigente", () => {
  it("el funcionario asignado por su id puede responder", () => {
    expect(puedeResponderComoAsignado(perm("FUNCIONARIO_DEPENDENCIA"), "u1", [{ usuarioId: "u1", dependenciaId: null }])).toBe(true);
  });

  it("un funcionario de la dependencia asignada (reparto sin usuario puntual) puede responder", () => {
    expect(puedeResponderComoAsignado(perm("FUNCIONARIO_DEPENDENCIA", { dependenciaId: "depA" }), "u9", [{ usuarioId: null, dependenciaId: "depA" }])).toBe(true);
  });

  it("quien reparte (ADMIN_ARCHIVO) ya NO puede escribir el borrador si no está asignado", () => {
    expect(puedeResponderComoAsignado(perm("ADMIN_ARCHIVO"), "u2", [{ usuarioId: "u1", dependenciaId: null }])).toBe(false);
  });

  it("el ADMIN mantiene el acceso como superusuario", () => {
    expect(puedeResponderComoAsignado(admin, "u2", [{ usuarioId: "u1", dependenciaId: null }])).toBe(true);
  });

  it("sin repartos vigentes, nadie salvo el admin responde", () => {
    expect(puedeResponderComoAsignado(perm("FUNCIONARIO_DEPENDENCIA"), "u1", [])).toBe(false);
  });
});
