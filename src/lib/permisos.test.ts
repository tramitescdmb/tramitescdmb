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
  puedeVerExpedienteContractual,
  puedeVerDocumentoContrato,
  puedeSubirDocumentoContrato,
  puedeGestionarExpedienteCompleto,
  puedeValidarDocumentoContrato,
  puedeEliminarExpedienteContractual,
  puedeAsignarFirmantesComunicacion,
  puedeFirmarComunicacionDirecto,
  puedeAsignarFirmantesDocumentoContrato,
  type PermisosUsuario,
} from "./permisos";
import type { RolContratacion } from "@prisma/client";

const BASE_CONTRATACION = {
  rolesContratacion: new Set<RolContratacion>(),
  contratistaId: null,
  supervisaExpedientes: new Set<string>(),
  asignadoExpedientes: new Set<string>(),
  cargos: new Set<string>(),
  cargosEncargo: new Set<string>(),
};

const admin: PermisosUsuario = { esAdmin: true, tramites: new Map(), secciones: new Set(), correspondencia: null, dependenciaId: null, puedeFirmar: true, ...BASE_CONTRATACION };
const sinAcceso: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: null, dependenciaId: null, puedeFirmar: false, ...BASE_CONTRATACION };
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
  ...BASE_CONTRATACION,
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
  const funcionarioDepA: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: "depA", puedeFirmar: true, ...BASE_CONTRATACION };
  const funcionarioDepB: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: "depB", puedeFirmar: true, ...BASE_CONTRATACION };
  const sinDependencia: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "FUNCIONARIO_DEPENDENCIA", dependenciaId: null, puedeFirmar: true, ...BASE_CONTRATACION };
  const adminArchivo: PermisosUsuario = { esAdmin: false, tramites: new Map(), secciones: new Set(), correspondencia: "ADMIN_ARCHIVO", dependenciaId: null, puedeFirmar: true, ...BASE_CONTRATACION };

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
  ...BASE_CONTRATACION,
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

const permContrat = (roles: RolContratacion | RolContratacion[] | null, extra: Partial<PermisosUsuario> = {}): PermisosUsuario => ({
  esAdmin: false,
  tramites: new Map(),
  secciones: new Set(),
  correspondencia: null,
  dependenciaId: null,
  puedeFirmar: false,
  rolesContratacion: new Set(roles === null ? [] : Array.isArray(roles) ? roles : [roles]),
  contratistaId: null,
  supervisaExpedientes: new Set<string>(),
  asignadoExpedientes: new Set<string>(),
  cargos: new Set<string>(),
  cargosEncargo: new Set<string>(),
  ...extra,
});

describe("Acceso a expedientes contractuales (GECON) por etapa y asignación — criterios de aceptación", () => {
  const expA = { id: "expA", contratistaId: "contXYZ", dependenciaSolicitanteId: "depA", eliminado: false };
  const expedientePrecontractual = { ...expA, etapaActual: "PRECONTRACTUAL" as const };
  const expedienteContractual = { ...expA, etapaActual: "CONTRACTUAL" as const };

  describe("(a) un CONTRATISTA (usuario final) nunca entra a la etapa Precontractual", () => {
    it("no ve el expediente mientras está en Precontractual, aunque sea su propio contrato", () => {
      const contratista = permContrat("CONTRATISTA", { contratistaId: "contXYZ" });
      expect(puedeVerExpedienteContractual(contratista, expedientePrecontractual)).toBe(false);
    });

    it("sí ve el expediente una vez pasó a Contractual", () => {
      const contratista = permContrat("CONTRATISTA", { contratistaId: "contXYZ" });
      expect(puedeVerExpedienteContractual(contratista, expedienteContractual)).toBe(true);
    });

    it("no puede subir documentos de la etapa Precontractual ni siquiera cuando el expediente ya avanzó", () => {
      const contratista = permContrat("CONTRATISTA", { contratistaId: "contXYZ" });
      expect(puedeSubirDocumentoContrato(contratista, expedienteContractual, "PRECONTRACTUAL")).toBe(false);
      expect(puedeSubirDocumentoContrato(contratista, expedienteContractual, "CONTRACTUAL")).toBe(true);
    });

    it("no puede ver/descargar un documento puntual de la etapa Precontractual, aunque el expediente ya esté en Contractual", () => {
      const contratista = permContrat("CONTRATISTA", { contratistaId: "contXYZ" });
      expect(puedeVerDocumentoContrato(contratista, expedienteContractual, "PRECONTRACTUAL")).toBe(false);
      expect(puedeVerDocumentoContrato(contratista, expedienteContractual, "CONTRACTUAL")).toBe(true);
    });

    it("un contratista de OTRO contrato no ve el expediente en ninguna etapa", () => {
      const otroContratista = permContrat("CONTRATISTA", { contratistaId: "otroContratista" });
      expect(puedeVerExpedienteContractual(otroContratista, expedientePrecontractual)).toBe(false);
      expect(puedeVerExpedienteContractual(otroContratista, expedienteContractual)).toBe(false);
    });
  });

  describe("(b) Personal de Contratación (FUNCIONARIO_CONTRATACION) solo entra a lo que el Jefe le asignó", () => {
    it("no abre un expediente ajeno ni cambiando el ID en la URL", () => {
      const personal = permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["expAsignado"]) });
      expect(puedeVerExpedienteContractual(personal, { ...expedienteContractual, id: "expAsignado" })).toBe(true);
      expect(puedeVerExpedienteContractual(personal, { ...expedienteContractual, id: "expOtroDistinto" })).toBe(false);
    });

    it("tampoco puede editar los datos generales ni validar documentos de un expediente no asignado", () => {
      const personal = permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["expAsignado"]) });
      expect(puedeGestionarExpedienteCompleto(personal, { id: "expOtroDistinto" })).toBe(false);
      expect(puedeGestionarExpedienteCompleto(personal, { id: "expAsignado" })).toBe(true);
      expect(puedeValidarDocumentoContrato(personal, { id: "expOtroDistinto" })).toBe(false);
      expect(puedeValidarDocumentoContrato(personal, { id: "expAsignado" })).toBe(true);
    });

    it("sin ninguna asignación, no ve ningún expediente (denegado por defecto)", () => {
      const personalSinAsignar = permContrat("FUNCIONARIO_CONTRATACION");
      expect(puedeVerExpedienteContractual(personalSinAsignar, expedienteContractual)).toBe(false);
    });
  });

  describe("(c) una misma persona con varios roles suma los accesos de cada uno", () => {
    const supervisorYPersonal = permContrat(["SUPERVISOR_INTERVENTOR", "FUNCIONARIO_CONTRATACION"], {
      supervisaExpedientes: new Set(["expSupervisado"]),
      asignadoExpedientes: new Set(["expAsignado"]),
    });

    it("ve y gestiona tanto lo que supervisa como lo que tiene asignado como personal", () => {
      for (const id of ["expSupervisado", "expAsignado"]) {
        expect(puedeVerExpedienteContractual(supervisorYPersonal, { ...expedienteContractual, id })).toBe(true);
        expect(puedeGestionarExpedienteCompleto(supervisorYPersonal, { id })).toBe(true);
        expect(puedeAsignarFirmantesDocumentoContrato(supervisorYPersonal, { id, dependenciaSolicitanteId: "depA" })).toBe(true);
      }
      expect(puedeVerExpedienteContractual(supervisorYPersonal, { ...expedienteContractual, id: "expAjeno" })).toBe(false);
    });

    it("valida documentos solo donde actúa como personal asignado", () => {
      expect(puedeValidarDocumentoContrato(supervisorYPersonal, { id: "expAsignado" })).toBe(true);
      expect(puedeValidarDocumentoContrato(supervisorYPersonal, { id: "expSupervisado" })).toBe(false);
    });

    it("un jefe de dependencia que también supervisa ve los de su dependencia y los que supervisa", () => {
      const jefeYSupervisor = permContrat(["JEFE_DEPENDENCIA", "SUPERVISOR_INTERVENTOR"], { dependenciaId: "depB", supervisaExpedientes: new Set(["expA"]) });
      expect(puedeVerExpedienteContractual(jefeYSupervisor, expedienteContractual)).toBe(true);
      expect(puedeVerExpedienteContractual(jefeYSupervisor, { ...expedienteContractual, id: "otro", dependenciaSolicitanteId: "depB" })).toBe(true);
      expect(puedeVerExpedienteContractual(jefeYSupervisor, { ...expedienteContractual, id: "otro2", dependenciaSolicitanteId: "depC" })).toBe(false);
    });
  });

  it("el Jefe y el Administrador de Contratación ven y gestionan cualquier expediente, en cualquier etapa", () => {
    const jefe = permContrat("JEFE_CONTRATACION");
    const admin = permContrat("ADMINISTRADOR_CONTRATACION");
    for (const p of [jefe, admin]) {
      expect(puedeVerExpedienteContractual(p, expedientePrecontractual)).toBe(true);
      expect(puedeVerExpedienteContractual(p, expedienteContractual)).toBe(true);
      expect(puedeGestionarExpedienteCompleto(p, { id: "cualquiera" })).toBe(true);
    }
  });
});

describe("Editar y eliminar expedientes (ítem 4) — por rol, y visibilidad de un expediente eliminado", () => {
  const exp = { id: "expA", contratistaId: "contXYZ", dependenciaSolicitanteId: "depA", etapaActual: "CONTRACTUAL" as const };

  describe("editar el contrato o expediente: Jefe, Personal asignado y Supervisor (del expediente) — nadie más", () => {
    it("el Jefe y el Administrador de Contratación siempre pueden", () => {
      expect(puedeGestionarExpedienteCompleto(permContrat("JEFE_CONTRATACION"), exp)).toBe(true);
      expect(puedeGestionarExpedienteCompleto(permContrat("ADMINISTRADOR_CONTRATACION"), exp)).toBe(true);
    });

    it("el Personal de contratación solo si está asignado a ESE expediente", () => {
      expect(puedeGestionarExpedienteCompleto(permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["expA"]) }), exp)).toBe(true);
      expect(puedeGestionarExpedienteCompleto(permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["otro"]) }), exp)).toBe(false);
    });

    it("el Supervisor solo si supervisa ESE expediente", () => {
      expect(puedeGestionarExpedienteCompleto(permContrat("SUPERVISOR_INTERVENTOR", { supervisaExpedientes: new Set(["expA"]) }), exp)).toBe(true);
      expect(puedeGestionarExpedienteCompleto(permContrat("SUPERVISOR_INTERVENTOR", { supervisaExpedientes: new Set(["otro"]) }), exp)).toBe(false);
    });

    it("un Contratista o un Jefe de dependencia no pueden editar", () => {
      expect(puedeGestionarExpedienteCompleto(permContrat("CONTRATISTA", { contratistaId: "contXYZ" }), exp)).toBe(false);
      expect(puedeGestionarExpedienteCompleto(permContrat("JEFE_DEPENDENCIA", { dependenciaId: "depA" }), exp)).toBe(false);
    });
  });

  describe("eliminar un expediente: solo el Jefe de contratación (o el admin de la plataforma)", () => {
    it("el Jefe de contratación puede eliminar", () => {
      expect(puedeEliminarExpedienteContractual(permContrat("JEFE_CONTRATACION"))).toBe(true);
    });

    it("el admin de la plataforma puede eliminar", () => {
      expect(puedeEliminarExpedienteContractual({ ...permContrat(null), esAdmin: true })).toBe(true);
    });

    it("ni el Administrador de Contratación (rol del módulo), ni Personal, ni Supervisor, ni Contratista pueden eliminar", () => {
      expect(puedeEliminarExpedienteContractual(permContrat("ADMINISTRADOR_CONTRATACION"))).toBe(false);
      expect(puedeEliminarExpedienteContractual(permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["expA"]) }))).toBe(false);
      expect(puedeEliminarExpedienteContractual(permContrat("SUPERVISOR_INTERVENTOR", { supervisaExpedientes: new Set(["expA"]) }))).toBe(false);
      expect(puedeEliminarExpedienteContractual(permContrat("CONTRATISTA"))).toBe(false);
    });
  });

  it("un expediente eliminado no lo ve nadie por esta vía, ni siquiera el Jefe o el Administrador", () => {
    const expEliminado = { ...exp, eliminado: true };
    expect(puedeVerExpedienteContractual(permContrat("JEFE_CONTRATACION"), expEliminado)).toBe(false);
    expect(puedeVerExpedienteContractual(permContrat("ADMINISTRADOR_CONTRATACION"), expEliminado)).toBe(false);
    expect(puedeVerExpedienteContractual(permContrat("FUNCIONARIO_CONTRATACION", { asignadoExpedientes: new Set(["expA"]) }), expEliminado)).toBe(false);
    expect(puedeVerExpedienteContractual(permContrat("JEFE_CONTRATACION"), { ...exp, eliminado: false })).toBe(true);
  });
});

describe("firmas de comunicaciones del SGDEA", () => {
  const sgdea = (rol: PermisosUsuario["correspondencia"], extra: Partial<PermisosUsuario> = {}): PermisosUsuario => ({
    ...sinAcceso,
    correspondencia: rol,
    puedeFirmar: true,
    ...extra,
  });
  const recibida = { radicadoPorId: "ventanilla-1" };

  it("cualquier funcionario con acceso al SGDEA puede firmar y asignar firmas, sin importar su rol", () => {
    for (const rol of ["FUNCIONARIO_DEPENDENCIA", "JEFE_DEPENDENCIA", "ADMIN_ARCHIVO"] as const) {
      expect(puedeAsignarFirmantesComunicacion(sgdea(rol), recibida, "funcionario-1")).toBe(true);
      expect(puedeFirmarComunicacionDirecto(sgdea(rol), recibida, "funcionario-1")).toBe(true);
    }
  });

  it("la ventanilla de radicación nunca firma ni envía a firmar", () => {
    expect(puedeAsignarFirmantesComunicacion(sgdea("OPERADOR_VENTANILLA"), recibida, "otro")).toBe(false);
    expect(puedeFirmarComunicacionDirecto(sgdea("OPERADOR_VENTANILLA"), recibida, "otro")).toBe(false);
  });

  it("quien radicó la comunicación no firma ni asigna firmas sobre ella", () => {
    expect(puedeAsignarFirmantesComunicacion(sgdea("ADMIN_ARCHIVO"), recibida, "ventanilla-1")).toBe(false);
    expect(puedeFirmarComunicacionDirecto(sgdea("ADMIN_ARCHIVO"), recibida, "ventanilla-1")).toBe(false);
  });

  it("un contratista puede firmar pero no asignar firmas a nadie", () => {
    const contratista = sgdea("FUNCIONARIO_DEPENDENCIA", { rolesContratacion: new Set(["CONTRATISTA"]) });
    expect(puedeFirmarComunicacionDirecto(contratista, recibida, "c-1")).toBe(true);
    expect(puedeAsignarFirmantesComunicacion(contratista, recibida, "c-1")).toBe(false);
  });

  it("sin acceso al SGDEA no hay firmas", () => {
    expect(puedeAsignarFirmantesComunicacion(sinAcceso, recibida, "x")).toBe(false);
    expect(puedeFirmarComunicacionDirecto(sinAcceso, recibida, "x")).toBe(false);
  });
});
