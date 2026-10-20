import { describe, expect, it } from "vitest";
import {
  construirMatriz,
  esJefeDeReparto,
  puedeAccederCorrespondencia,
  puedeAdministrarArchivo,
  puedeAsignarFirmantesComunicacion,
  puedeCerrarExpediente,
  puedeDespachar,
  puedeDistribuir,
  puedeEnviarMemorandoPorPerfil,
  puedeFirmar,
  puedeFirmarComunicacionDirecto,
  puedeGestionarArchivo,
  puedeGestionarExpedienteDeDependencia,
  puedeRadicar,
  puedeResponderComoAsignado,
  puedeSubdistribuirInternamente,
  puedeVerNivelAccesoExpediente,
  type PermisosUsuario,
} from "@/lib/permisos";
import { puedeOperarFlujos } from "@/lib/flujos";
import { PERFILES_SEMILLA, matrizSemilla, permisosDeReferencia } from "@/lib/perfiles-equivalencia";
import type { Matriz } from "@/lib/perfiles-catalogo";

const DEP = "dependencia-referencia";
const OTRA = "otra-dependencia";
const YO = "usuario-referencia";

function enModoPerfil(base: PermisosUsuario, matriz: Matriz, excepciones: Parameters<typeof construirMatriz>[1] = []): PermisosUsuario {
  return {
    ...base,
    correspondencia: null,
    porPerfil: new Set(["SGDEA"]),
    matriz: construirMatriz(
      Object.entries(matriz).map(([funcionalidad, acciones]) => ({ funcionalidad, acciones })),
      excepciones
    ),
  };
}

function huella(p: PermisosUsuario) {
  const reparto = [{ usuarioId: YO, dependenciaId: DEP }];
  return {
    acceso: puedeAccederCorrespondencia(p),
    radicar: puedeRadicar(p),
    despachar: puedeDespachar(p),
    firmar: puedeFirmar(p),
    distribuir: puedeDistribuir(p),
    administrar: puedeAdministrarArchivo(p),
    archivo: puedeGestionarArchivo(p),
    cerrar: puedeCerrarExpediente(p),
    jefe: esJefeDeReparto(p),
    subdistribuir: puedeSubdistribuirInternamente(p, YO, { dependenciaDestinoId: DEP }, reparto),
    subdistribuirAjena: puedeSubdistribuirInternamente(p, YO, { dependenciaDestinoId: OTRA }, reparto),
    responder: puedeResponderComoAsignado(p, YO, reparto),
    responderAjena: puedeResponderComoAsignado(p, YO, [{ usuarioId: "otro", dependenciaId: OTRA }]),
    expedientePropio: puedeGestionarExpedienteDeDependencia(p, DEP),
    expedienteAjeno: puedeGestionarExpedienteDeDependencia(p, OTRA),
    reservadoPropio: puedeVerNivelAccesoExpediente(p, { nivelAcceso: "RESERVADA", dependenciaId: DEP }),
    reservadoAjeno: puedeVerNivelAccesoExpediente(p, { nivelAcceso: "RESERVADA", dependenciaId: OTRA }),
    asignarFirmantes: puedeAsignarFirmantesComunicacion(p, { radicadoPorId: "otro" }, YO),
    firmarDirecto: puedeFirmarComunicacionDirecto(p, { radicadoPorId: "otro" }, YO),
    operarFlujos: puedeOperarFlujos(p),
    memorandos: puedeEnviarMemorandoPorPerfil(p),
  };
}

const semillasSgdea = PERFILES_SEMILLA.filter((s) => s.modulo === "SGDEA");

describe("SGDEA por perfiles: mismo acceso que con los roles", () => {
  it.each(semillasSgdea.map((s) => [s.nombre, s] as const))("%s", (_nombre, semilla) => {
    const legado = permisosDeReferencia(semilla.rol);
    expect(huella(enModoPerfil(legado, matrizSemilla(semilla)))).toEqual(huella(legado));
  });

  it("sin perfil del SGDEA no hay acceso, aunque conserve el rol antiguo", () => {
    const legado = permisosDeReferencia({ tipo: "CORRESPONDENCIA", rol: "OPERADOR_VENTANILLA" });
    const sinPerfil = { ...enModoPerfil(legado, {}), correspondencia: "OPERADOR_VENTANILLA" as const };
    expect(puedeAccederCorrespondencia(sinPerfil)).toBe(false);
    expect(puedeRadicar(sinPerfil)).toBe(false);
  });

  it("una excepción quita una acción concreta del perfil", () => {
    const semilla = semillasSgdea.find((s) => s.claveOrigen === "SGDEA:OPERADOR_VENTANILLA")!;
    const p = enModoPerfil(permisosDeReferencia(semilla.rol), matrizSemilla(semilla), [
      { funcionalidad: "sgdea.radicacion", tipo: "QUITAR", acciones: ["ACTUALIZAR"] },
    ]);
    expect(puedeRadicar(p)).toBe(true);
    expect(puedeDespachar(p)).toBe(false);
  });

  it("una excepción concede una acción que el perfil no da", () => {
    const semilla = semillasSgdea.find((s) => s.claveOrigen === "SGDEA:FUNCIONARIO_DEPENDENCIA")!;
    const p = enModoPerfil(permisosDeReferencia(semilla.rol), matrizSemilla(semilla), [
      { funcionalidad: "sgdea.memorandos", tipo: "CONCEDER", acciones: ["CREAR"] },
    ]);
    expect(puedeEnviarMemorandoPorPerfil(p)).toBe(true);
    expect(puedeRadicar(p)).toBe(false);
  });

  it("el administrador del sistema conserva todo aunque el SGDEA vaya por perfiles", () => {
    const admin = enModoPerfil(permisosDeReferencia({ tipo: "ADMIN" }), {});
    expect(puedeAccederCorrespondencia(admin)).toBe(true);
    expect(puedeAdministrarArchivo(admin)).toBe(true);
  });

  it("si el módulo está oculto para el usuario, el perfil no da acceso", () => {
    const semilla = semillasSgdea.find((s) => s.claveOrigen === "SGDEA:ADMIN_ARCHIVO")!;
    const p = { ...enModoPerfil(permisosDeReferencia(semilla.rol), matrizSemilla(semilla)), modulos: new Set<never>() };
    expect(puedeAccederCorrespondencia(p)).toBe(false);
  });
});
