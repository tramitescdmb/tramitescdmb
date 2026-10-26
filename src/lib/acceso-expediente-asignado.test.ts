import { describe, expect, it } from "vitest";
import type { ModuloAplicativo, RolContratacion } from "@prisma/client";
import { puedeAccederFirmasTramite, puedeEditarTramite, puedeVerExpedienteTramite, type PermisosUsuario } from "./permisos";
import { construirWhereExpedientes } from "./expedientes";

const base: PermisosUsuario = {
  esAdmin: false,
  tramites: new Map(),
  secciones: new Set(),
  correspondencia: null,
  dependenciaId: null,
  puedeFirmar: true,
  rolesContratacion: new Set<RolContratacion>(),
  contratistaId: null,
  supervisaExpedientes: new Set(),
  asignadoExpedientes: new Set(),
  cargos: new Set(),
  cargosEncargo: new Set(),
  modulos: new Set<ModuloAplicativo>(["TRAMITES"]),
  porPerfil: new Set(),
  matriz: new Map(),
};

describe("acceso a un expediente por asignación", () => {
  const contratista: PermisosUsuario = { ...base, expedientesTramite: new Set(["exp-1"]) };

  it("ve el expediente asignado aunque no tenga alcance sobre el tipo de trámite", () => {
    expect(puedeVerExpedienteTramite(contratista, { id: "exp-1", tramiteTipoId: "t9" })).toBe(true);
    expect(puedeVerExpedienteTramite(contratista, { id: "exp-2", tramiteTipoId: "t9" })).toBe(false);
  });

  it("la asignación da consulta, no edición del trámite", () => {
    expect(puedeEditarTramite(contratista, "t9")).toBe(false);
  });

  it("con un expediente asignado puede entrar a su buzón de firmas", () => {
    expect(puedeAccederFirmasTramite(contratista)).toBe(true);
    expect(puedeAccederFirmasTramite(base)).toBe(false);
  });

  it("el listado incluye los expedientes asignados junto a los de su alcance", () => {
    const w = construirWhereExpedientes({ tramiteIdsPermitidos: ["t1"], expedienteIdsAsignados: ["exp-1"], rango: null });
    expect(w).toEqual({ AND: [{ OR: [{ tramiteTipoId: { in: ["t1"] } }, { id: { in: ["exp-1"] } }] }] });
  });

  it("«Asignados a mí» incluye las visitas en que participa", () => {
    const w = construirWhereExpedientes({ tramiteIdsPermitidos: null, rango: null, soloMios: true, usuarioId: "u1" }) as { AND: { OR: unknown[] }[] };
    expect(JSON.stringify(w.AND[0]!.OR)).toContain("participantes");
  });
});
