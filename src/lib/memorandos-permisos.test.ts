import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/config-sitio", () => ({ getConfiguracionSitio: async () => ({}) }));

const { accedeMemorandos, oficinaOrigenMemorando, puedeRecibirMemorando, puedeEnviarMemorando, whereMemorandos, whereVerMemorando } = await import("@/lib/memorandos");

function permisos(extra: Record<string, unknown> = {}) {
  return { esAdmin: false, dependenciaId: "dep-1", correspondencia: null, porPerfil: new Set(), matriz: new Map(), ...extra } as never;
}

describe("quién envía memorandos", () => {
  it("solo Director(a) General, Secretario(a) General, Subdirector(a), Jefe(a) de Oficina y Coordinador(a) de Grupo", () => {
    for (const d of ["DIRECTOR_GENERAL", "SECRETARIO_GENERAL", "SUBDIRECTOR", "JEFE_OFICINA", "COORDINADOR_GRUPO"]) expect(puedeEnviarMemorando(permisos(), d, true)).toBe(true);
    for (const d of ["SECRETARIO", "ASESOR_DIRECCION", "REVISOR_FISCAL", "PROFESIONAL_ESPECIALIZADO", "CONTRATISTA", null]) {
      expect(puedeEnviarMemorando(permisos(), d, true)).toBe(false);
    }
  });

  it("el administrador puede enviar (pruebas); un rol del SGDEA no lo habilita sin el cargo", () => {
    expect(puedeEnviarMemorando(permisos({ esAdmin: true }), "PROFESIONAL_UNIVERSITARIO", true)).toBe(true);
    expect(puedeEnviarMemorando(permisos({ esAdmin: true, dependenciaId: null }), null, false)).toBe(true);
    expect(puedeEnviarMemorando(permisos({ correspondencia: "OPERADOR_VENTANILLA" }), null, true)).toBe(false);
  });

  it("sin dependencia o con el módulo oculto no se envía", () => {
    expect(puedeEnviarMemorando(permisos({ dependenciaId: null }), "JEFE_OFICINA", true)).toBe(false);
    expect(puedeEnviarMemorando(permisos(), "JEFE_OFICINA", false)).toBe(false);
  });
});

describe("acceso al módulo", () => {
  it("todo funcionario con dependencia entra si el módulo está visible", () => {
    expect(accedeMemorandos(permisos(), true)).toBe(true);
    expect(accedeMemorandos(permisos(), false)).toBe(false);
    expect(accedeMemorandos(permisos({ dependenciaId: null }), true)).toBe(false);
    expect(accedeMemorandos(permisos({ esAdmin: true, dependenciaId: null }), false)).toBe(true);
  });

  it("quien proyectó o revisó tiene su bandeja «Por firmar»", () => {
    expect(whereMemorandos({ id: "u1", dependenciaId: "dep-1", firmante: false, acceso: true, archivo: false }, "por-firmar")).toEqual({
      tipo: "INTERNA",
      estado: { not: "ANULADA" },
      solicitudesFirma: { some: { usuarioAsignadoId: "u1", estado: "PENDIENTE", rol: "FIRMA" } },
    });
  });

  it("cada quien ve solo los memorandos en que participa", () => {
    const w = whereVerMemorando({ id: "u1", dependenciaId: "dep-1", firmante: false, acceso: true, archivo: false });
    expect(w).toEqual({ tipo: "INTERNA", OR: [{ radicadoPorId: "u1" }, { respuestaPorId: "u1" }, { distribuciones: { some: { usuarioId: "u1" } } }, { solicitudesFirma: { some: { usuarioAsignadoId: "u1" } } }] });
    expect(whereVerMemorando({ id: "u1", dependenciaId: null, firmante: false, acceso: false, archivo: false })).toEqual({ id: "" });
    expect(whereVerMemorando({ id: "u1", dependenciaId: "d", firmante: true, acceso: true, archivo: true })).toEqual({ tipo: "INTERNA" });
  });
});

describe("oficina de origen del memorando", () => {
  it("el funcionario autorizado firma solo desde su oficina", () => {
    expect(oficinaOrigenMemorando({ dependenciaId: "dep-1", origenLibre: false }, null)).toEqual({ id: "dep-1" });
    expect(oficinaOrigenMemorando({ dependenciaId: "dep-1", origenLibre: false }, "dep-1")).toEqual({ id: "dep-1" });
    expect(oficinaOrigenMemorando({ dependenciaId: "dep-1", origenLibre: false }, "dep-2")).toEqual({ error: "Solo puede enviar memorandos desde la oficina a la que pertenece." });
    expect("error" in oficinaOrigenMemorando({ dependenciaId: null, origenLibre: false }, "dep-2")).toBe(true);
  });
  it("el administrador puede elegir cualquier oficina", () => {
    expect(oficinaOrigenMemorando({ dependenciaId: null, origenLibre: true }, "dep-2")).toEqual({ id: "dep-2" });
    expect(oficinaOrigenMemorando({ dependenciaId: "dep-1", origenLibre: true }, null)).toEqual({ id: "dep-1" });
    expect("error" in oficinaOrigenMemorando({ dependenciaId: null, origenLibre: true }, null)).toBe(true);
  });
});

describe("destinatario del memorando", () => {
  it("solo reciben los mismos cargos que envían", () => {
    for (const d of ["DIRECTOR_GENERAL", "SECRETARIO_GENERAL", "SUBDIRECTOR", "JEFE_OFICINA", "COORDINADOR_GRUPO"]) {
      expect(puedeRecibirMemorando({ denominacionEmpleo: d, rolesContratacion: [] })).toBe(true);
    }
  });
  it("no reciben un funcionario sin esos cargos ni un contratista", () => {
    expect(puedeRecibirMemorando({ denominacionEmpleo: "PROFESIONAL_ESPECIALIZADO", rolesContratacion: [] })).toBe(false);
    expect(puedeRecibirMemorando({ denominacionEmpleo: null, rolesContratacion: [] })).toBe(false);
    expect(puedeRecibirMemorando({ denominacionEmpleo: null, rolesContratacion: ["CONTRATISTA"] })).toBe(false);
    expect(puedeRecibirMemorando({ denominacionEmpleo: "JEFE_OFICINA", rolesContratacion: ["CONTRATISTA"] })).toBe(false);
  });
});
