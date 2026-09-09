import { describe, it, expect } from "vitest";
import { flujoAMermaid, type PasoDiagrama, type TransicionDiagrama } from "./flujos-diagrama";

const pasos: PasoDiagrama[] = [
  { id: "a", orden: 1, nombre: "Asignación y estudio", tipo: "TAREA" },
  { id: "b", orden: 2, nombre: "Revisión", tipo: "REVISION" },
  { id: "c", orden: 3, nombre: "Cierre", tipo: "FIN" },
];
const trans: TransicionDiagrama[] = [
  { desdePasoId: "a", haciaPasoId: "b", etiqueta: "Continuar" },
  { desdePasoId: "b", haciaPasoId: "c", etiqueta: "Aprobar" },
  { desdePasoId: "b", haciaPasoId: "a", etiqueta: "Devolver" },
];

describe("flujoAMermaid", () => {
  it("arma un flowchart con nodo inicio, formas por tipo y transiciones etiquetadas", () => {
    const m = flujoAMermaid(pasos, trans);
    expect(m).toContain("flowchart TD");
    expect(m).toContain('inicio((" "))');
    expect(m).toContain("inicio --> n1");
    expect(m).toContain('n1["1 · Asignación y estudio"]');
    expect(m).toContain('n2{{"2 · Revisión"}}'); // hexágono para REVISION
    expect(m).toContain('n3(["3 · Cierre"])'); // stadium para FIN
    expect(m).toContain('n1 -->|"Continuar"| n2');
    expect(m).toContain('n2 -->|"Devolver"| n1'); // ciclo hacia atrás
  });

  it("marca el paso actual y los pasos hechos", () => {
    const m = flujoAMermaid(pasos, trans, { pasoActualId: "b", pasosHechosIds: ["a", "b"] });
    expect(m).toContain("class n2 actual");
    expect(m).toContain("class n1 hecho"); // a está hecho y no es el actual
    expect(m).not.toContain("class n2 hecho"); // el actual no se marca también como hecho
  });

  it("escapa comillas y recorta nombres largos", () => {
    const m = flujoAMermaid(
      [{ id: "x", orden: 1, nombre: 'Paso "raro" con un nombre extremadamente largo que no cabe entero', tipo: "TAREA" }],
      [],
    );
    expect(m).not.toMatch(/n1\[".*".*".*"\]/); // sin comillas internas sin escapar
    expect(m).toContain("…");
  });

  it("un flujo sin pasos no revienta", () => {
    expect(flujoAMermaid([], [])).toContain("Sin pasos");
  });
});
