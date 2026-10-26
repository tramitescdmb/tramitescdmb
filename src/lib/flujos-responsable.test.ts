import { describe, expect, it } from "vitest";
import { esDevolucion, esResponsablePaso, puedeCompletarPaso, type ContextoResponsable, type UsuarioFlujo } from "@/lib/flujos";
import { validarEstructuraFlujo } from "@/lib/flujos-plantillas";

const ctx: ContextoResponsable = {
  asignadoAId: "u-manual",
  responsableAnteriorId: "u-anterior",
  comunicacion: { dependenciaDestinoId: "dep-juridica", dependenciaOrigenId: "dep-ventanilla", radicadoPorId: "u-radico" },
};
const usuario = (o: Partial<UsuarioFlujo>): UsuarioFlujo => ({ usuarioId: "u-x", dependenciaId: null, cargos: new Set(), esAdminArchivo: false, ...o });
const paso = (asignacion: Parameters<typeof esResponsablePaso>[0]["asignacion"], extra: { dependenciaId?: string; cargoClave?: string } = {}) => ({
  asignacion,
  dependenciaId: extra.dependenciaId ?? null,
  cargoClave: extra.cargoClave ?? null,
});

describe("responsable de un paso de flujo", () => {
  it("dependencia de la comunicación: quien pertenece a la dependencia destino", () => {
    expect(esResponsablePaso(paso("DEPENDENCIA_COMUNICACION"), ctx, usuario({ dependenciaId: "dep-juridica" }))).toBe(true);
    expect(esResponsablePaso(paso("DEPENDENCIA_COMUNICACION"), ctx, usuario({ dependenciaId: "dep-ventanilla" }))).toBe(false);
  });

  it("dependencia fija y cargo", () => {
    expect(esResponsablePaso(paso("DEPENDENCIA_FIJA", { dependenciaId: "dep-a" }), ctx, usuario({ dependenciaId: "dep-a" }))).toBe(true);
    expect(esResponsablePaso(paso("CARGO", { cargoClave: "Secretario General" }), ctx, usuario({ cargos: new Set(["Secretario General"]) }))).toBe(true);
    expect(esResponsablePaso(paso("CARGO", { cargoClave: "Secretario General" }), ctx, usuario({ cargos: new Set(["Otro"]) }))).toBe(false);
  });

  it("radicador, responsable anterior y asignación manual", () => {
    expect(esResponsablePaso(paso("RADICADOR"), ctx, usuario({ usuarioId: "u-radico" }))).toBe(true);
    expect(esResponsablePaso(paso("RESPONSABLE_PASO_ANTERIOR"), ctx, usuario({ usuarioId: "u-anterior" }))).toBe(true);
    expect(esResponsablePaso(paso("MANUAL"), ctx, usuario({ usuarioId: "u-manual" }))).toBe(true);
    expect(esResponsablePaso(paso("MANUAL"), ctx, usuario({ usuarioId: "u-otro" }))).toBe(false);
  });

  it("el administrador del archivo puede completar cualquier paso", () => {
    expect(puedeCompletarPaso(paso("MANUAL"), ctx, usuario({ esAdminArchivo: true }))).toBe(true);
  });

  it("volver a un paso anterior es una devolución; ir al fin no", () => {
    expect(esDevolucion({ orden: 3 }, { orden: 1, tipo: "TAREA" })).toBe(true);
    expect(esDevolucion({ orden: 3 }, { orden: 4, tipo: "TAREA" })).toBe(false);
    expect(esDevolucion({ orden: 3 }, { orden: 2, tipo: "FIN" })).toBe(false);
  });

  it("no deja activar un paso de cargo o dependencia fija sin elegirlo", () => {
    const problemas = validarEstructuraFlujo([
      { id: "a", nombre: "Revisar", tipo: "TAREA", orden: 1, transiciones: [{ haciaPasoId: "b" }], asignacion: "CARGO", cargoClave: null },
      { id: "b", nombre: "Fin", tipo: "FIN", orden: 2, transiciones: [] },
    ]);
    expect(problemas.map((p) => p.mensaje).join(" ")).toMatch(/no se eligió cuál/);
  });
});
