import { describe, it, expect } from "vitest";
import { flujoABpmn } from "./flujos-bpmn";

const flujo = {
  id: "cflujo123",
  nombre: 'Gestión "PQRSD" & visto bueno',
  pasos: [
    { id: "a", orden: 1, nombre: "Proyección", tipo: "TAREA" as const, posX: 100, posY: 100, transiciones: [{ haciaPasoId: "b", etiqueta: "Enviar" }] },
    { id: "b", orden: 2, nombre: "Visto bueno", tipo: "REVISION" as const, posX: 300, posY: 100, transiciones: [
      { haciaPasoId: "c", etiqueta: "Aprobar" },
      { haciaPasoId: "a", etiqueta: "Devolver" },
    ] },
    { id: "c", orden: 3, nombre: "Cierre", tipo: "FIN" as const, posX: 500, posY: 100, transiciones: [] },
  ],
};

describe("flujoABpmn", () => {
  const xml = flujoABpmn(flujo);

  it("es un BPMN 2.0 con process, startEvent, userTask, endEvent y sequenceFlow", () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("http://www.omg.org/spec/BPMN/20100524/MODEL");
    expect(xml).toContain('<bpmn:startEvent id="Inicio_1"');
    expect(xml).toContain('<bpmn:userTask id="Paso_1" name="Proyección">');
    expect(xml).toContain('<bpmn:endEvent id="End_3" name="Cierre">');
    expect(xml).toMatch(/<bpmn:sequenceFlow id="Flow_\d+" name="Aprobar" sourceRef="Paso_2" targetRef="End_3" \/>/);
    expect(xml).toMatch(/name="Devolver" sourceRef="Paso_2" targetRef="Paso_1"/); // ciclo
  });

  it("escapa comillas y ampersand en los nombres", () => {
    expect(xml).toContain('name="Gestión &quot;PQRSD&quot; &amp; visto bueno"');
  });

  it("incluye sección de diagrama con las posiciones", () => {
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    expect(xml).toContain('<dc:Bounds x="300" y="100"');
  });
});
