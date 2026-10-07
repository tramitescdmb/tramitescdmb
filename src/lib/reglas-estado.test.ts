import { describe, expect, it } from "vitest";
import { evaluarCambioManualEstado, resultadosDelPaso } from "./reglas-estado";

const pr39 = [
  { numero: 4, titulo: "NOTIFICAR Y PROGRAMAR LA VISITA", esDecision: false, opciones: null },
  { numero: 5, titulo: "REALIZAR VISITA TÉCNICA", esDecision: false, opciones: null },
  {
    numero: 6,
    titulo: "ELABORAR RESOLUCIÓN DE APROBACIÓN O NEGACIÓN",
    esDecision: true,
    opciones: [
      { respuesta: "Aprobar", siguientePaso: 7, resultado: "APROBADO" },
      { respuesta: "Negar", siguientePaso: 7, resultado: "NEGADO" },
    ],
  },
  { numero: 7, titulo: "NOTIFICAR AL USUARIO", esDecision: false, opciones: null },
];

describe("evaluarCambioManualEstado", () => {
  it("no deja aprobar antes del paso de decisión", () => {
    const r = evaluarCambioManualEstado(pr39, 5, "APROBADO");
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain("desde el paso 6");
  });

  it("deja aprobar o negar desde el paso de decisión en adelante", () => {
    expect(evaluarCambioManualEstado(pr39, 6, "APROBADO").permitido).toBe(true);
    expect(evaluarCambioManualEstado(pr39, 7, "NEGADO").permitido).toBe(true);
  });

  it("permite desistido, archivado o suspendido en cualquier paso", () => {
    for (const e of ["DESISTIDO", "ARCHIVADO", "SUSPENDIDO", "RECHAZADO", "EN_TRAMITE"]) expect(evaluarCambioManualEstado(pr39, 1, e).permitido).toBe(true);
  });

  it("sin paso de decisión solo deja aprobar en el último paso", () => {
    const pasos = [
      { numero: 1, titulo: "RADICAR", esDecision: false, opciones: null },
      { numero: 2, titulo: "EXPEDIR CERTIFICADO", esDecision: false, opciones: null },
    ];
    expect(evaluarCambioManualEstado(pasos, 1, "APROBADO").permitido).toBe(false);
    expect(evaluarCambioManualEstado(pasos, 2, "APROBADO").permitido).toBe(true);
  });

  it("lee los resultados de las opciones de un paso", () => {
    expect(resultadosDelPaso(pr39[2])).toEqual(["APROBADO", "NEGADO"]);
    expect(resultadosDelPaso(pr39[0])).toEqual([]);
  });
});
