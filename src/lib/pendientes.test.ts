import { describe, expect, it } from "vitest";
import { clasificarPendientes, type ExpedientePendientes, type SesionPendientes } from "./pendientes";

const COORD_EVAL = "Coordinador(a) de Evaluación para la Sostenibilidad";
const NOTIFICADOR = "Servidor(a) de Notificaciones";

function expediente(over: Partial<ExpedientePendientes> = {}): ExpedientePendientes {
  return {
    id: "e1",
    numero: "M-DA-PR05-2026-0001",
    estado: "EN_TRAMITE",
    pasoActualNumero: 1,
    tramiteNombre: "Permiso de vertimientos",
    pasos: [
      { numero: 1, titulo: "Elaborar informe técnico", responsables: ["Servidor técnico responsable"], documentos: [], esDecision: false },
    ],
    documentosCargados: [],
    usuariosAsignadosIds: [],
    cargosAsignadosNombres: [],
    ...over,
  };
}

const funcionario: SesionPendientes = { userId: "u1", rol: "FUNCIONARIO", cargo: COORD_EVAL };

describe("clasificarPendientes", () => {
  it("cuenta los expedientes activos asignados al usuario (por usuario o por cargo)", () => {
    const r = clasificarPendientes(
      [
        expediente({ id: "a", usuariosAsignadosIds: ["u1"] }),
        expediente({ id: "b", cargosAsignadosNombres: [COORD_EVAL] }),
        expediente({ id: "c" }), // sin asignar
        expediente({ id: "d", estado: "APROBADO", usuariosAsignadosIds: ["u1"] }), // terminal, no cuenta
      ],
      funcionario
    );
    expect(r.asignadosTotal).toBe(2);
  });

  it("marca 'requiere decisión' cuando el paso actual es de decisión y le corresponde por cargo", () => {
    const e = expediente({
      pasos: [
        { numero: 1, titulo: "¿Aprobar o negar?", responsables: ["Coordinador de Evaluación para la sostenibilidad"], documentos: [], esDecision: true },
      ],
    });
    const r = clasificarPendientes([e], funcionario);
    expect(r.decisiones).toHaveLength(1);
    expect(r.gestionPaso).toHaveLength(0);
    expect(r.decisiones[0].numero).toBe(e.numero);
  });

  it("no muestra el paso de otro cargo a un funcionario que no lo tiene ni lo tiene asignado", () => {
    const e = expediente({
      pasos: [{ numero: 1, titulo: "Notificar al usuario", responsables: ["Servidor responsable de notificar"], documentos: [], esDecision: false }],
    });
    const r = clasificarPendientes([e], funcionario);
    expect(r.gestionPaso).toHaveLength(0);

    const notificador: SesionPendientes = { userId: "u2", rol: "FUNCIONARIO", cargo: NOTIFICADOR };
    const r2 = clasificarPendientes([e], notificador);
    expect(r2.gestionPaso).toHaveLength(1);
  });

  it("lista un documento requerido del paso que aún no se ha cargado, y omite el que sí", () => {
    const e = expediente({
      usuariosAsignadosIds: ["u1"],
      pasos: [
        { numero: 1, titulo: "Radicar", responsables: ["Servidor de Ventanilla"], documentos: ["Formato de solicitud", "Recibo de pago"], esDecision: false },
      ],
      documentosCargados: [{ pasoNumero: 1, descripcion: "Formato de solicitud", nombre: "form.pdf" }],
    });
    const r = clasificarPendientes([e], funcionario);
    expect(r.documentos.map((d) => d.detalle)).toEqual(["Recibo de pago"]);
  });

  it("cuenta como cargado el documento de radicación (pasoNumero null) para el paso 1", () => {
    const e = expediente({
      usuariosAsignadosIds: ["u1"],
      pasos: [{ numero: 1, titulo: "Radicar", responsables: ["Ventanilla"], documentos: ["Formato de solicitud"], esDecision: false }],
      documentosCargados: [{ pasoNumero: null, descripcion: "Formato de solicitud", nombre: "form.pdf" }],
    });
    const r = clasificarPendientes([e], funcionario);
    expect(r.documentos).toHaveLength(0);
  });

  it("incluye los expedientes con información adicional requerida que le corresponden", () => {
    const e = expediente({
      estado: "INFORMACION_ADICIONAL_REQUERIDA",
      cargosAsignadosNombres: [COORD_EVAL],
    });
    const r = clasificarPendientes([e], funcionario);
    expect(r.informacionAdicional).toHaveLength(1);
  });

  it("el ADMIN ve todas las decisiones e informaciones adicionales, aunque no le estén asignadas", () => {
    const admin: SesionPendientes = { userId: "admin", rol: "ADMIN", cargo: null };
    const decision = expediente({
      id: "dec",
      pasos: [{ numero: 1, titulo: "Decidir", responsables: ["Director General"], documentos: [], esDecision: true }],
    });
    const infoAdic = expediente({ id: "ia", estado: "INFORMACION_ADICIONAL_REQUERIDA" });
    const r = clasificarPendientes([decision, infoAdic], admin);
    expect(r.esAdmin).toBe(true);
    expect(r.decisiones).toHaveLength(1);
    expect(r.informacionAdicional).toHaveLength(1);
    // pasos normales sin asignar NO se le listan al admin
    expect(r.gestionPaso).toHaveLength(0);
  });

  it("hayAlgo es falso cuando no hay nada pendiente", () => {
    const r = clasificarPendientes([expediente({ id: "x" })], funcionario);
    expect(r.hayAlgo).toBe(false);
  });
});
