import { describe, expect, it } from "vitest";
import { avanceValido, evaluarCambioManualEstado, resultadosDelPaso } from "./reglas-estado";

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

describe("avanceValido", () => {
  const lineal = [
    { numero: 1, esDecision: false, opciones: null },
    { numero: 2, esDecision: false, opciones: null },
    { numero: 3, esDecision: false, opciones: null },
  ];
  it("solo deja pasar al paso inmediatamente siguiente", () => {
    expect(avanceValido(lineal, 1, 2, null)).toBe(true);
    expect(avanceValido(lineal, 1, 3, null)).toBe(false);
    expect(avanceValido(lineal, 2, 1, null)).toBe(false);
    expect(avanceValido(lineal, 1, null, null)).toBe(false);
    expect(avanceValido(lineal, 1, Number.NaN, null)).toBe(false);
  });
  it("no acepta un resultado en un paso sin decisión", () => {
    expect(avanceValido(lineal, 1, 2, "APROBADO")).toBe(false);
  });
  const conDecision = [
    { numero: 1, esDecision: false, opciones: null },
    {
      numero: 2,
      esDecision: true,
      opciones: [
        { respuesta: "Sí", siguientePaso: 3 },
        { respuesta: "No", resultado: "NEGADO" },
        { respuesta: "Requiere ajustes", siguientePaso: 1 },
      ],
    },
    { numero: 3, esDecision: false, opciones: null },
  ];
  it("en una decisión solo acepta las combinaciones de sus opciones", () => {
    expect(avanceValido(conDecision, 2, 3, null)).toBe(true);
    expect(avanceValido(conDecision, 2, null, "NEGADO")).toBe(true);
    expect(avanceValido(conDecision, 2, 1, null)).toBe(true);
    expect(avanceValido(conDecision, 2, 3, "NEGADO")).toBe(false);
    expect(avanceValido(conDecision, 2, null, "APROBADO")).toBe(false);
  });
  it("una decisión sin opciones avanza al siguiente paso", () => {
    const pasos = [{ numero: 1, esDecision: true, opciones: null }, { numero: 2, esDecision: false, opciones: null }];
    expect(avanceValido(pasos, 1, 2, null)).toBe(true);
  });
});
