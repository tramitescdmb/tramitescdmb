import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { avanceValido, evaluarCambioManualEstado, opcionFinalizar, resultadosDelPaso } from "./reglas-estado";

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

describe("todos los procedimientos se pueden finalizar", () => {
  const dir = path.join(__dirname, "..", "..", "data", "tramites");
  type P = { numero: number; titulo: string; esDecision: boolean; opciones: unknown };
  const flujos = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .flatMap((f) => {
      const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as { codigo: string; flujos: { codigo: string; pasos: P[] }[] };
      return t.flujos.map((fl) => ({ nombre: `${t.codigo}/${fl.codigo}`, pasos: fl.pasos }));
    });
  const ESTADOS = new Set(["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"]);

  it("los resultados de las decisiones son estados del sistema (o solo marcan el camino)", () => {
    for (const { nombre, pasos } of flujos) {
      for (const p of pasos) {
        for (const o of (Array.isArray(p.opciones) ? p.opciones : []) as { resultado?: string | null; siguientePaso?: number | null }[]) {
          if (o.resultado && o.siguientePaso == null) expect(ESTADOS.has(o.resultado), `${nombre} paso ${p.numero}: ${o.resultado}`).toBe(true);
        }
      }
    }
  });

  it("desde el último paso de cada procedimiento se puede finalizar, con o sin decisión previa", () => {
    for (const { nombre, pasos } of flujos) {
      const ultimo = Math.max(...pasos.map((p) => p.numero));
      for (const estado of ["EN_TRAMITE", "APROBADO", "NEGADO"]) {
        const op = opcionFinalizar(pasos, ultimo, estado);
        expect(op.puede, `${nombre} en ${estado}`).toBe(true);
        if (estado === "EN_TRAMITE") expect(op.resultados.length, nombre).toBeGreaterThan(0);
      }
    }
  });

  it("antes del último paso solo se finaliza en la rama de desistimiento o archivo", () => {
    const pasos = [
      { numero: 1, opciones: null },
      { numero: 2, opciones: [{ resultado: "APROBADO" }, { resultado: "NEGADO" }] },
      { numero: 3, opciones: null },
    ];
    expect(opcionFinalizar(pasos, 3, "APROBADO")).toEqual({ puede: true, resultados: [] });
    expect(opcionFinalizar(pasos, 2, "APROBADO").puede).toBe(false);
    expect(opcionFinalizar(pasos, 1, "DESISTIDO")).toEqual({ puede: true, resultados: [] });
    expect(opcionFinalizar(pasos, 3, "EN_TRAMITE").resultados).toEqual(["APROBADO", "NEGADO"]);
    expect(opcionFinalizar([{ numero: 1, opciones: null }], 1, "EN_TRAMITE").resultados).toEqual(["APROBADO"]);
  });
});
