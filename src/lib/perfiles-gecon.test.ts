import { describe, expect, it } from "vitest";
import type { EtapaContratacion, RolContratacion } from "@prisma/client";
import * as P from "@/lib/permisos";
import { PERFILES_SEMILLA, matrizSemilla, permisosDeReferencia } from "@/lib/perfiles-equivalencia";
import type { Matriz } from "@/lib/perfiles-catalogo";

const EXP = "expediente-referencia";
const DEP = "dependencia-referencia";
const CTR = "contratista-referencia";

function enModoPerfil(base: P.PermisosUsuario, matriz: Matriz, excepciones: Parameters<typeof P.construirMatriz>[1] = []): P.PermisosUsuario {
  return {
    ...base,
    rolesContratacion: new Set<RolContratacion>(),
    porPerfil: new Set(["GECON"]),
    matriz: P.construirMatriz(
      Object.entries(matriz).map(([funcionalidad, acciones]) => ({ funcionalidad, acciones })),
      excepciones
    ),
  };
}

const exp = (id: string, contratistaId: string | null, dependencia: string, etapaActual: EtapaContratacion = "CONTRACTUAL") => ({
  id,
  contratistaId,
  dependenciaSolicitanteId: dependencia,
  etapaActual,
  eliminado: false,
  cerrado: false,
});

const propio = exp(EXP, CTR, DEP);
const propioPre = exp(EXP, CTR, DEP, "PRECONTRACTUAL");
const deDependencia = exp("otro-de-dependencia", "otro-contratista", DEP);
const ajeno = exp("ajeno", "otro-contratista", "otra-dependencia");

function huella(p: P.PermisosUsuario) {
  const h: Record<string, unknown> = {
    acceso: P.puedeAccederContratacion(p),
    administrar: P.puedeAdministrarContratacion(p),
    aprobar: P.puedeAprobarEtapaContratacion(p),
    catalogo: P.puedeAdministrarCatalogoContratacion(p),
    crear: P.puedeCrearExpedienteContractual(p),
    tablero: P.puedeVerTableroContratos(p),
    sinTraza: P.puedeEditarSinTrazaDocumentoContrato(p),
    adminGecon: P.puedeAdministrarGecon(p),
    verRegistro: P.puedeVerRegistroContratistas(p),
    gestionarContratistas: P.puedeGestionarContratistas(p),
    registrarMinimo: P.puedeRegistrarContratistaMinimo(p),
    asignarPersonal: P.puedeAsignarPersonalContrato(p),
    subirCualquierEtapa: P.puedeSubirEnCualquierEtapaContrato(p),
    etapas: P.puedeGestionarEtapasContratacion(p),
    eliminar: P.puedeEliminarExpedienteContractual(p),
    esContratista: P.esContratistaGecon(p),
    veTodos: P.veTodosLosContratos(p),
    veDependencia: P.veContratosDeSuDependencia(p),
    esPersonal: P.esPersonalContratacion(p),
    supervisa: P.supervisaElExpediente(p, EXP),
    supervisaAjeno: P.supervisaElExpediente(p, "ajeno"),
    manual: P.puedeEditarManualDemostracion(p, "GECON"),
    filtroContratistas: JSON.stringify(P.filtroContratistasVisibles(p)),
    verContratistaPropio: P.puedeVerContratista(p, { expedientes: [{ id: EXP }] }),
    verContratistaSinExp: P.puedeVerContratista(p, { expedientes: [] }),
    editarContratistaPropio: P.puedeEditarContratistaMinimo(p, { expedientes: [{ id: EXP }] }),
    editarContratistaAjeno: P.puedeEditarContratistaMinimo(p, { expedientes: [{ id: "ajeno" }] }),
  };
  for (const [nombre, e] of Object.entries({ propio, propioPre, deDependencia, ajeno })) {
    h[`ver:${nombre}`] = P.puedeVerExpedienteContractual(p, e);
    h[`verDocPre:${nombre}`] = P.puedeVerDocumentoContrato(p, e, "PRECONTRACTUAL");
    h[`verDocCon:${nombre}`] = P.puedeVerDocumentoContrato(p, e, "CONTRACTUAL");
    h[`subirPre:${nombre}`] = P.puedeSubirDocumentoContrato(p, e, "PRECONTRACTUAL");
    h[`subirCon:${nombre}`] = P.puedeSubirDocumentoContrato(p, e, "CONTRACTUAL");
    h[`periodos:${nombre}`] = P.puedeGestionarPeriodosInforme(p, e);
    h[`modificacion:${nombre}`] = P.puedeRegistrarModificacionContrato(p, e);
    h[`firmantes:${nombre}`] = P.puedeAsignarFirmantesDocumentoContrato(p, e);
    h[`conTrazaPre:${nombre}`] = P.puedeEditarConTrazaDocumentoContrato(p, e, "PRECONTRACTUAL");
    h[`conTrazaCon:${nombre}`] = P.puedeEditarConTrazaDocumentoContrato(p, e, "CONTRACTUAL");
    h[`validar:${nombre}`] = P.puedeValidarDocumentoContrato(p, e, "PRECONTRACTUAL");
    h[`completo:${nombre}`] = P.puedeGestionarExpedienteCompleto(p, e);
    h[`datos:${nombre}`] = P.puedeEditarDatosContrato(p, e);
  }
  return h;
}

const semillasGecon = PERFILES_SEMILLA.filter((s) => s.modulo === "GECON");

describe("GECON por perfiles: mismo acceso que con los roles", () => {
  it.each(semillasGecon.map((s) => [s.nombre, s] as const))("%s", (_nombre, semilla) => {
    const legado = permisosDeReferencia(semilla.rol);
    expect(huella(enModoPerfil(legado, matrizSemilla(semilla)))).toEqual(huella(legado));
  });

  it("sin perfil de GECON no hay acceso, aunque conserve el rol antiguo", () => {
    const legado = permisosDeReferencia({ tipo: "CONTRATACION", rol: "JEFE_CONTRATACION" });
    const sinPerfil = { ...enModoPerfil(legado, {}), rolesContratacion: new Set<RolContratacion>(["JEFE_CONTRATACION"]) };
    expect(P.puedeAccederContratacion(sinPerfil)).toBe(false);
    expect(P.puedeAprobarEtapaContratacion(sinPerfil)).toBe(false);
  });

  it("una excepción da la etapa precontractual a un contratista concreto", () => {
    const semilla = semillasGecon.find((s) => s.claveOrigen === "GECON:CONTRATISTA")!;
    const p = enModoPerfil(permisosDeReferencia(semilla.rol), matrizSemilla(semilla), [
      { funcionalidad: "gecon.precontractual", tipo: "CONCEDER", acciones: ["LEER"] },
    ]);
    expect(P.puedeVerExpedienteContractual(p, propioPre)).toBe(true);
    expect(P.esContratistaGecon(p)).toBe(false);
  });

  it("quitar el alcance total deja al jefe de contratación solo con lo relacionado", () => {
    const semilla = semillasGecon.find((s) => s.claveOrigen === "GECON:JEFE_CONTRATACION")!;
    const p = enModoPerfil(permisosDeReferencia(semilla.rol), matrizSemilla(semilla), [{ funcionalidad: "gecon.todos", tipo: "QUITAR", acciones: ["LEER"] }]);
    expect(P.puedeVerExpedienteContractual(p, ajeno)).toBe(false);
    expect(P.puedeAprobarEtapaContratacion(p)).toBe(true);
  });
});
