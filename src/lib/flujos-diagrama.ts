/**
 * Genera la definición Mermaid (`flowchart`) de un flujo de trabajo a partir de
 * sus pasos y transiciones. Puro y testeable — el componente `Flujograma` solo
 * se encarga de pintarlo. Un paso puede marcarse como "actual" (verde) o "hecho"
 * (verde claro) para el diagrama de una instancia en curso.
 */

export type PasoDiagrama = {
  id: string;
  orden: number;
  nombre: string;
  tipo: "TAREA" | "REVISION" | "DECISION" | "FIN";
};

export type TransicionDiagrama = {
  desdePasoId: string;
  haciaPasoId: string;
  etiqueta: string;
};

/** Deja el texto seguro para un nodo/etiqueta de Mermaid entre comillas. */
function limpiar(texto: string, max = 42): string {
  const t = texto.replace(/["\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return (t.length > max ? t.slice(0, max - 1) + "…" : t) || " ";
}

function nodo(paso: PasoDiagrama): string {
  const id = `n${paso.orden}`;
  const txt = `"${paso.orden} · ${limpiar(paso.nombre)}"`;
  switch (paso.tipo) {
    case "DECISION":
      return `${id}{${txt}}`;
    case "REVISION":
      return `${id}{{${txt}}}`;
    case "FIN":
      return `${id}([${txt}])`;
    default:
      return `${id}[${txt}]`;
  }
}

export function flujoAMermaid(
  pasos: PasoDiagrama[],
  transiciones: TransicionDiagrama[],
  opts: { pasoActualId?: string | null; pasosHechosIds?: string[] } = {},
): string {
  if (pasos.length === 0) return "flowchart TD\n  vacio[\"Sin pasos\"]";

  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden);
  const ordenPorId = new Map(pasos.map((p) => [p.id, p.orden]));
  const hechos = new Set(opts.pasosHechosIds ?? []);

  const lineas: string[] = ["flowchart TD"];
  lineas.push(`  inicio((" ")):::inicio`);
  lineas.push(`  inicio --> n${ordenados[0]!.orden}`);

  for (const p of ordenados) lineas.push(`  ${nodo(p)}`);

  for (const t of transiciones) {
    const a = ordenPorId.get(t.desdePasoId);
    const b = ordenPorId.get(t.haciaPasoId);
    if (a === undefined || b === undefined) continue;
    lineas.push(`  n${a} -->|"${limpiar(t.etiqueta, 28)}"| n${b}`);
  }

  lineas.push("  classDef inicio fill:#57635b,stroke:#57635b,color:#ffffff");
  lineas.push("  classDef actual fill:#1c7a45,stroke:#125c33,color:#ffffff,font-weight:bold");
  lineas.push("  classDef hecho fill:#e3f3e8,stroke:#1f7a4d,color:#14532d");

  const actualOrden = opts.pasoActualId ? ordenPorId.get(opts.pasoActualId) : undefined;
  if (actualOrden !== undefined) lineas.push(`  class n${actualOrden} actual`);
  const hechosOrden = ordenados.filter((p) => hechos.has(p.id) && p.orden !== actualOrden).map((p) => `n${p.orden}`);
  if (hechosOrden.length) lineas.push(`  class ${hechosOrden.join(",")} hecho`);

  return lineas.join("\n");
}
