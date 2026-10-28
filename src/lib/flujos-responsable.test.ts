import { describe, expect, it } from "vitest";
import { ASIGNACIONES_DE_MODULO, TIPOS_PASO_DE_MODULO, etiquetaAsignacion, moduloDeAmbito } from "@/lib/flujos-modulos";
import { aplicaAFormulario, objetivoDeInstancia, plantillasDeModulo, esDevolucion, esResponsablePaso, esSalidaRechazo, evaluarFirmasComunicacion, puedeCompletarPaso, type ContextoResponsable, type UsuarioFlujo } from "@/lib/flujos";
import { validarEstructuraFlujo } from "@/lib/flujos-plantillas";

const ctx: ContextoResponsable = {
  asignadoAId: "u-manual",
  responsableAnteriorId: "u-anterior",
  comunicacion: { dependenciaDestinoId: "dep-juridica", dependenciaOrigenId: "dep-ventanilla", radicadoPorId: "u-radico" },
};
const usuario = (o: Partial<UsuarioFlujo>): UsuarioFlujo => ({ usuarioId: "u-x", dependenciaId: null, cargos: new Set(), esAdministrador: false, ...o });
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
    expect(puedeCompletarPaso(paso("MANUAL"), ctx, usuario({ esAdministrador: true }))).toBe(true);
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

describe("paso de firma del flujo", () => {
  const sol = (estado: "PENDIENTE" | "COMPLETADA" | "RECHAZADA", min: number, comentario: string | null = null) => ({
    rol: "FIRMA",
    estado,
    asignadoEn: new Date(2026, 0, 1, 8, min),
    completadoEn: estado === "PENDIENTE" ? null : new Date(2026, 0, 1, 9, min),
    comentario,
  });

  it("sin firmantes, pendiente, firmado y rechazado", () => {
    expect(evaluarFirmasComunicacion([], 0).estado).toBe("SIN_FIRMANTES");
    expect(evaluarFirmasComunicacion([], 1).estado).toBe("FIRMADO");
    expect(evaluarFirmasComunicacion([sol("COMPLETADA", 1), sol("PENDIENTE", 2)], 1)).toEqual({ estado: "PENDIENTE", completadas: 1, total: 2 });
    expect(evaluarFirmasComunicacion([sol("COMPLETADA", 1), sol("COMPLETADA", 2)], 2).estado).toBe("FIRMADO");
    expect(evaluarFirmasComunicacion([sol("RECHAZADA", 1, "Cambiar el destinatario")], 0)).toEqual({ estado: "RECHAZADO", motivo: "Cambiar el destinatario" });
  });

  it("un rechazo ya atendido con una nueva asignación no cuenta", () => {
    const nueva = { ...sol("COMPLETADA", 30), asignadoEn: new Date(2026, 0, 1, 10, 0), completadoEn: new Date(2026, 0, 1, 11, 0) };
    expect(evaluarFirmasComunicacion([sol("RECHAZADA", 1, "x"), nueva], 1).estado).toBe("FIRMADO");
  });

  it("reconoce la salida de rechazo por su etiqueta", () => {
    expect(esSalidaRechazo("Rechazado")).toBe(true);
    expect(esSalidaRechazo("Devolver con observaciones")).toBe(true);
    expect(esSalidaRechazo("Firmado")).toBe(false);
  });

  it("un flujo de expediente toma la dependencia y el creador del expediente como responsables", () => {
    const objetivo = objetivoDeInstancia({
      comunicacion: null,
      expedienteDocumental: { id: "e1", numero: "EXP-1", asunto: "Contratos 2026", dependenciaId: "dep-archivo", creadoPorId: "u-creo" },
    });
    expect(objetivo.esComunicacion).toBe(false);
    expect(objetivo.href).toBe("/correspondencia/expedientes/e1#flujo");
    const c = { asignadoAId: null, responsableAnteriorId: null, comunicacion: objetivo.ctx };
    expect(esResponsablePaso(paso("DEPENDENCIA_COMUNICACION"), c, usuario({ dependenciaId: "dep-archivo" }))).toBe(true);
    expect(esResponsablePaso(paso("RADICADOR"), c, usuario({ usuarioId: "u-creo" }))).toBe(true);
  });

  it("en GECON responden el personal asignado, el supervisor y la dependencia solicitante del contrato", () => {
    const objetivo = objetivoDeInstancia({
      comunicacion: null,
      expedienteDocumental: null,
      expedienteContractual: {
        id: "c1",
        numero: "CDMB-CTO-2026-000001",
        numeroContrato: "050-2026",
        objeto: "Prestación de servicios",
        dependenciaSolicitanteId: "dep-planeacion",
        creadoPorId: "u-creo",
        asignados: [{ usuarioId: "u-abogado" }],
        supervisores: [{ usuarioId: "u-super" }],
      },
    });
    expect(objetivo.modulo).toBe("GECON");
    expect(objetivo.href).toBe("/contratacion/expedientes/c1#flujo-trabajo");
    const c = { asignadoAId: null, responsableAnteriorId: null, comunicacion: objetivo.ctx };
    expect(esResponsablePaso(paso("PERSONAL_ASIGNADO"), c, usuario({ usuarioId: "u-abogado" }))).toBe(true);
    expect(esResponsablePaso(paso("PERSONAL_ASIGNADO"), c, usuario({ usuarioId: "u-super" }))).toBe(false);
    expect(esResponsablePaso(paso("SUPERVISOR"), c, usuario({ usuarioId: "u-super" }))).toBe(true);
    expect(esResponsablePaso(paso("DEPENDENCIA_COMUNICACION"), c, usuario({ dependenciaId: "dep-planeacion" }))).toBe(true);
  });

  it("en Trámites responde el personal asignado al expediente y quien lo radicó", () => {
    const objetivo = objetivoDeInstancia({
      comunicacion: null,
      expedienteDocumental: null,
      expedienteTramite: { id: "t1", numero: "M-DA-PR21-2026-0001", createdById: "u-radico", tramiteTipo: { nombre: "Concesión de aguas" }, usuariosAsignados: [{ id: "u-tecnico" }] },
    });
    expect(objetivo.modulo).toBe("TRAMITES");
    const c = { asignadoAId: null, responsableAnteriorId: null, comunicacion: objetivo.ctx };
    expect(esResponsablePaso(paso("PERSONAL_ASIGNADO"), c, usuario({ usuarioId: "u-tecnico" }))).toBe(true);
    expect(esResponsablePaso(paso("RADICADOR"), c, usuario({ usuarioId: "u-radico" }))).toBe(true);
    expect(esResponsablePaso(paso("SUPERVISOR"), c, usuario({ usuarioId: "u-tecnico" }))).toBe(false);
  });

  it("cada módulo guarda sus flujos en su propio ámbito", () => {
    expect(aplicaAFormulario("EXPEDIENTE", "GECON")).toEqual({ aplicaA: null, ambito: "CONTRATO" });
    expect(aplicaAFormulario("RECIBIDA", "TRAMITES")).toEqual({ aplicaA: null, ambito: "TRAMITE" });
    expect(moduloDeAmbito("CONTRATO")).toBe("GECON");
    expect(moduloDeAmbito("EXPEDIENTE")).toBe("SGDEA");
    expect(ASIGNACIONES_DE_MODULO.SGDEA).not.toContain("SUPERVISOR");
    expect(TIPOS_PASO_DE_MODULO.GECON).not.toContain("FIRMA");
    expect(etiquetaAsignacion("DEPENDENCIA_COMUNICACION", "GECON")).toBe("Dependencia solicitante del contrato");
    for (const modulo of ["SGDEA", "GECON", "TRAMITES"] as const) {
      for (const p of plantillasDeModulo(modulo)) {
        expect(moduloDeAmbito(p.ambito ?? "COMUNICACION")).toBe(modulo);
        expect(p.pasos.every((x) => ASIGNACIONES_DE_MODULO[modulo].includes(x.asignacion))).toBe(true);
      }
    }
  });

  it("el formulario distingue flujos de comunicaciones y de expedientes", () => {
    expect(aplicaAFormulario("EXPEDIENTE")).toEqual({ aplicaA: null, ambito: "EXPEDIENTE" });
    expect(aplicaAFormulario("RECIBIDA")).toEqual({ aplicaA: "RECIBIDA", ambito: "COMUNICACION" });
    expect(aplicaAFormulario("")).toEqual({ aplicaA: null, ambito: "COMUNICACION" });
  });
});
