/**
 * Genera un XML BPMN 2.0 a partir de un flujo de trabajo (MoReq 7.13: los flujos
 * en un formato estándar). Puro y testeable. El paso `orden` 1 es el inicio; los
 * pasos de tipo FIN son eventos de fin; el resto son tareas de usuario; las
 * transiciones son `sequenceFlow` con nombre. Incluye una sección de diagrama
 * (BPMNDI) con las posiciones guardadas del lienzo para que abra ya distribuido.
 */

type PasoBpmn = {
  id: string;
  orden: number;
  nombre: string;
  tipo: "TAREA" | "REVISION" | "DECISION" | "FIN";
  posX: number | null;
  posY: number | null;
  transiciones: { haciaPasoId: string; etiqueta: string }[];
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function flujoABpmn(flujo: { id: string; nombre: string; pasos: PasoBpmn[] }): string {
  const pasos = [...flujo.pasos].sort((a, b) => a.orden - b.orden);
  const pid = flujo.id.replace(/[^A-Za-z0-9_-]/g, "");
  const elemId = (p: PasoBpmn) => (p.tipo === "FIN" ? `End_${p.orden}` : `Paso_${p.orden}`);
  const porId = new Map(pasos.map((p) => [p.id, p]));
  const pos = (p: PasoBpmn, i: number) => ({
    x: Math.round(p.posX ?? 160 + (i % 3) * 200),
    y: Math.round(p.posY ?? 100 + Math.floor(i / 3) * 120),
  });

  const flujos: { id: string; nombre: string; source: string; target: string }[] = [];
  let fi = 0;
  // Arranque: startEvent -> primer paso.
  const START = "Inicio_1";
  if (pasos[0]) flujos.push({ id: `Flow_${fi++}`, nombre: "", source: START, target: elemId(pasos[0]) });
  for (const p of pasos) {
    for (const t of p.transiciones) {
      const destino = porId.get(t.haciaPasoId);
      if (!destino) continue;
      flujos.push({ id: `Flow_${fi++}`, nombre: t.etiqueta, source: elemId(p), target: elemId(destino) });
    }
  }

  const salientes = (elId: string) => flujos.filter((f) => f.source === elId).map((f) => f.id);
  const entrantes = (elId: string) => flujos.filter((f) => f.target === elId).map((f) => f.id);

  const refs = (ids: string[], tag: "incoming" | "outgoing") =>
    ids.map((id) => `      <bpmn:${tag}>${id}</bpmn:${tag}>`).join("\n");

  const elementos: string[] = [];
  elementos.push(
    `    <bpmn:startEvent id="${START}" name="Inicio">\n${refs(salientes(START), "outgoing")}\n    </bpmn:startEvent>`,
  );
  for (const p of pasos) {
    const el = elemId(p);
    const cuerpo = [refs(entrantes(el), "incoming"), refs(salientes(el), "outgoing")].filter(Boolean).join("\n");
    if (p.tipo === "FIN") {
      elementos.push(`    <bpmn:endEvent id="${el}" name="${esc(p.nombre)}">\n${cuerpo}\n    </bpmn:endEvent>`);
    } else {
      elementos.push(`    <bpmn:userTask id="${el}" name="${esc(p.nombre)}">\n${cuerpo}\n    </bpmn:userTask>`);
    }
  }
  for (const f of flujos) {
    const nombre = f.nombre ? ` name="${esc(f.nombre)}"` : "";
    elementos.push(`    <bpmn:sequenceFlow id="${f.id}"${nombre} sourceRef="${f.source}" targetRef="${f.target}" />`);
  }

  // Diagrama (posiciones del lienzo).
  const shapes: string[] = [];
  shapes.push(`      <bpmndi:BPMNShape id="${START}_di" bpmnElement="${START}"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>`);
  pasos.forEach((p, i) => {
    const { x, y } = pos(p, i);
    const w = p.tipo === "FIN" ? 36 : 120;
    const h = p.tipo === "FIN" ? 36 : 70;
    shapes.push(`      <bpmndi:BPMNShape id="${elemId(p)}_di" bpmnElement="${elemId(p)}"><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" /></bpmndi:BPMNShape>`);
  });
  const edges = flujos.map(
    (f) => `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}"><di:waypoint x="0" y="0" /><di:waypoint x="0" y="0" /></bpmndi:BPMNEdge>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${pid}" targetNamespace="http://cdmb.gov.co/sgdea">
  <bpmn:process id="Process_${pid}" name="${esc(flujo.nombre)}" isExecutable="false">
${elementos.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${pid}">
    <bpmndi:BPMNPlane id="Plane_${pid}" bpmnElement="Process_${pid}">
${shapes.join("\n")}
${edges.join("\n")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}
