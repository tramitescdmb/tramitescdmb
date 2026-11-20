import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { documentosObligatoriosDelPaso, documentosObligatoriosFaltantes } from "./documentos-obligatorios-paso";

type Paso = { numero: number; documentos: string[] };
const pr21 = JSON.parse(readFileSync(join(__dirname, "..", "..", "data", "tramites", "M-DA-PR21.json"), "utf-8")) as {
  flujos: { codigo: string; pasos: Paso[] }[];
};
const paso = (flujo: string, n: number) => pr21.flujos.find((f) => f.codigo === flujo)!.pasos.find((p) => p.numero === n)!;

describe("documentos obligatorios por paso (concesión de aguas M-DA-PR21)", () => {
  it("cada nombre de la tabla existe en el paso del procedimiento, en ambos flujos", () => {
    const esperados: Record<number, number> = { 1: 3, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 0, 8: 1, 9: 1, 10: 0 };
    for (const flujo of ["superficial", "subterranea"]) {
      for (const [n, cantidad] of Object.entries(esperados)) {
        expect(documentosObligatoriosDelPaso("M-DA-PR21", paso(flujo, Number(n))), `${flujo} paso ${n}`).toHaveLength(cantidad);
      }
    }
  });

  it("archivar el trámite en el paso 8 no exige la resolución", () => {
    expect(documentosObligatoriosFaltantes("M-DA-PR21", paso("superficial", 8), [], "APROBADO")).toEqual(["Resolución de concesión de agua"]);
    expect(documentosObligatoriosFaltantes("M-DA-PR21", paso("superficial", 8), [], "ARCHIVADO")).toEqual([]);
  });

  it("la notificación exige la constancia cargada en ese mismo paso", () => {
    const p9 = paso("superficial", 9);
    expect(documentosObligatoriosFaltantes("M-DA-PR21", p9, [{ pasoNumero: 8, descripcion: "Constancia de notificación (Personal y/o Edicto)" }])).toHaveLength(1);
    expect(documentosObligatoriosFaltantes("M-DA-PR21", p9, [{ pasoNumero: 9, descripcion: "Constancia de notificación (Personal y/o Edicto)" }])).toEqual([]);
  });

  it("la radicación cubre el formulario; el concepto del Planeador y la visita cubren el paso 6", () => {
    const faltan1 = documentosObligatoriosFaltantes("M-DA-PR21", paso("superficial", 1), [{ pasoNumero: null, descripcion: "Cédula de Ciudadanía" }]);
    expect(faltan1).toEqual(["Formato Control de Proceso E-GE-FO02 (lista de chequeo)", "Recibo de Pago"]);
    const faltan6 = documentosObligatoriosFaltantes(
      "M-DA-PR21",
      paso("superficial", 6),
      [{ pasoNumero: 6, descripcion: "Concepto técnico CT-0001-2026 (visita técnica)" }],
      null,
      true
    );
    expect(faltan6).toEqual([]);
  });

  it("otros procedimientos no exigen documentos (sin cambios)", () => {
    expect(documentosObligatoriosDelPaso("M-DA-PR48", { numero: 1, documentos: ["Recibo de Pago"] })).toEqual([]);
  });
});
