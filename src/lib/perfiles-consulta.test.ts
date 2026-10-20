import { describe, expect, it } from "vitest";
import type { ModuloAplicativo, NivelAccesoTramite, SeccionSoloLectura } from "@prisma/client";
import * as P from "@/lib/permisos";
import { PERFILES_SEMILLA, matrizSemilla, permisosDeReferencia, type PerfilSemilla } from "@/lib/perfiles-equivalencia";

const TODOS = new Set<ModuloAplicativo>(["TRAMITES", "SGDEA", "GECON", "VITAL", "SINCA"]);

function datosDe(semilla: PerfilSemilla) {
  const rol = semilla.rol;
  const tramitesAcceso: { tramiteTipoId: string; nivel: NivelAccesoTramite }[] =
    rol.tipo === "TRAMITES" ? [{ tramiteTipoId: "t1", nivel: rol.nivel }, { tramiteTipoId: "t2", nivel: rol.nivel }] : [];
  const seccionesAcceso: { seccion: SeccionSoloLectura }[] = rol.tipo === "SECCION" ? [{ seccion: rol.seccion }] : [];
  return { tramitesAcceso, seccionesAcceso };
}

function matrizMapa(semilla: PerfilSemilla) {
  return P.construirMatriz(Object.entries(matrizSemilla(semilla)).map(([funcionalidad, acciones]) => ({ funcionalidad, acciones })), []);
}

function permisosCon(semilla: PerfilSemilla, porPerfil: Set<string>): P.PermisosUsuario {
  const datos = datosDe(semilla);
  const matriz = porPerfil.size ? matrizMapa(semilla) : new Map<string, Set<string>>();
  const alcances = P.derivarAlcances({ modulos: TODOS, porPerfil, matriz, ...datos });
  return { ...permisosDeReferencia(semilla.rol), ...alcances, porPerfil, matriz };
}

function huella(p: P.PermisosUsuario) {
  return {
    tramites: [...p.tramites.entries()].sort(),
    secciones: [...p.secciones].sort(),
    accederT1: P.puedeAccederTramite(p, "t1"),
    editarT1: P.puedeEditarTramite(p, "t1"),
    accederOtro: P.puedeAccederTramite(p, "t9"),
    solicitantes: P.puedeAccederSolicitantes(p),
    firmas: P.puedeAccederFirmasTramite(p),
    vitalBase: P.puedeAccederSeccion(p, "VITAL_BASE"),
    vitalTablero: P.puedeAccederSeccion(p, "VITAL_DASHBOARD"),
    sincaBase: P.puedeAccederSeccion(p, "SINCA_BASE"),
    sincaTablero: P.puedeAccederSeccion(p, "SINCA_DASHBOARD"),
    mineria: P.puedeAccederSeccion(p, "SINCA_MINERIA"),
  };
}

const semillas = PERFILES_SEMILLA.filter((s) => ["TRAMITES", "VITAL", "SINCA"].includes(s.modulo));

describe("Trámites, VITAL y SINCA por perfiles: mismo acceso que con los roles", () => {
  it.each(semillas.map((s) => [s.nombre, s] as const))("%s", (_nombre, semilla) => {
    const legado = permisosCon(semilla, new Set());
    const perfil = permisosCon(semilla, new Set(["TRAMITES", "VITAL", "SINCA"]));
    expect(huella(perfil)).toEqual(huella(legado));
  });

  it("el perfil de consulta no puede gestionar aunque el trámite esté habilitado para editar", () => {
    const consulta = PERFILES_SEMILLA.find((s) => s.claveOrigen === "TRAMITES:VER")!;
    const alcances = P.derivarAlcances({
      modulos: TODOS,
      porPerfil: new Set(["TRAMITES"]),
      matriz: matrizMapa(consulta),
      tramitesAcceso: [{ tramiteTipoId: "t1", nivel: "EDITAR" }],
      seccionesAcceso: [],
    });
    expect(alcances.tramites.get("t1")).toBe("VER");
  });

  it("sin perfil de VITAL no ve VITAL aunque tenga la sección marcada", () => {
    const alcances = P.derivarAlcances({
      modulos: TODOS,
      porPerfil: new Set(["VITAL"]),
      matriz: new Map(),
      tramitesAcceso: [],
      seccionesAcceso: [{ seccion: "VITAL_BASE" }],
    });
    expect(alcances.secciones.has("VITAL_BASE")).toBe(false);
  });
});
