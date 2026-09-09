"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Save, Trash2, RotateCcw } from "lucide-react";

/**
 * Editor visual del flujo (React Flow, MIT). Se arrastran los pasos para
 * colocarlos y se tira desde el borde de un paso hasta otro para crear una
 * transición. Un panel lateral edita el paso o la conexión seleccionada.
 * "Guardar diagrama" manda todo a /api/correspondencia/flujos/[id]/lienzo.
 * Las propiedades finas del paso (instrucciones, término, responsable) siguen
 * en la lista de abajo.
 */

type Tipo = "TAREA" | "REVISION" | "DECISION" | "FIN";
const ETIQUETA_TIPO: Record<Tipo, string> = { TAREA: "Tarea", REVISION: "Revisión", DECISION: "Decisión", FIN: "Fin" };
const BORDE_TIPO: Record<Tipo, string> = {
  TAREA: "border-blue-300",
  REVISION: "border-amber-300",
  DECISION: "border-purple-300",
  FIN: "border-emerald-400",
};

type PasoLienzo = { id: string; orden: number; nombre: string; tipo: Tipo; posX: number | null; posY: number | null };
type TransLienzo = { id: string; desdePasoId: string; haciaPasoId: string; etiqueta: string };

type DatosNodo = { nombre: string; tipo: Tipo; inicial: boolean };

function NodoPaso({ data, selected }: NodeProps) {
  const d = data as unknown as DatosNodo;
  return (
    <div
      className={`min-w-[8rem] max-w-[13rem] border-2 bg-white px-3 py-2 text-xs shadow-sm transition ${BORDE_TIPO[d.tipo]} ${
        d.tipo === "FIN" ? "rounded-full" : "rounded-lg"
      } ${selected ? "ring-2 ring-cdmb-400" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-stone-400" />
      <p className="font-medium text-stone-800">
        {d.inicial && <span className="mr-1 text-cdmb-600">▶</span>}
        {d.nombre}
      </p>
      <span className="mt-0.5 inline-block rounded bg-stone-100 px-1 text-[10px] text-stone-500">{ETIQUETA_TIPO[d.tipo]}</span>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-cdmb-500" />
    </div>
  );
}

const nodeTypes = { paso: NodoPaso };

function auto(i: number) {
  return { x: 40 + (i % 3) * 230, y: 30 + Math.floor(i / 3) * 130 };
}

function Editor({
  flujoId,
  pasos,
  transiciones,
}: {
  flujoId: string;
  pasos: PasoLienzo[];
  transiciones: TransLienzo[];
}) {
  const router = useRouter();
  const ordenInicial = pasos.length ? Math.min(...pasos.map((p) => p.orden)) : 1;

  const [nodes, setNodes] = useState<Node[]>(() =>
    pasos.map((p, i) => ({
      id: p.id,
      type: "paso",
      position: p.posX != null && p.posY != null ? { x: p.posX, y: p.posY } : auto(i),
      data: { nombre: p.nombre, tipo: p.tipo, inicial: p.orden === ordenInicial },
    })),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    transiciones.map((t) => ({
      id: t.id,
      source: t.desdePasoId,
      target: t.haciaPasoId,
      label: t.etiqueta,
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  );
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<{ tipo: "nodo" | "edge"; id: string } | null>(null);

  const onNodesChange = useCallback((cs: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(cs, ns));
    if (cs.some((c) => c.type === "position" || c.type === "remove")) setSucio(true);
  }, []);
  const onEdgesChange = useCallback((cs: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(cs, es));
    if (cs.some((c) => c.type === "remove")) setSucio(true);
  }, []);
  const onConnect = useCallback((c: Connection) => {
    if (c.source === c.target) return;
    setEdges((es) => addEdge({ ...c, id: `nueva-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: "Continuar", markerEnd: { type: MarkerType.ArrowClosed } }, es));
    setSucio(true);
  }, []);

  function agregar(tipo: Tipo) {
    const id = `nuevo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNodes((ns) => [...ns, { id, type: "paso", position: { x: 60, y: 40 + ns.length * 18 }, data: { nombre: "Nuevo paso", tipo, inicial: false } }]);
    setSel({ tipo: "nodo", id });
    setSucio(true);
  }

  function editarNodo(id: string, campo: Partial<DatosNodo>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as object), ...campo } } : n)));
    setSucio(true);
  }
  function editarEdge(id: string, etiqueta: string) {
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, label: etiqueta } : e)));
    setSucio(true);
  }
  function borrarSel() {
    if (!sel) return;
    if (sel.tipo === "nodo") setNodes((ns) => ns.filter((n) => n.id !== sel.id));
    else setEdges((es) => es.filter((e) => e.id !== sel.id));
    setSel(null);
    setSucio(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const body = {
      nodos: nodes.map((n) => {
        const d = n.data as unknown as DatosNodo;
        return { id: n.id, nombre: d.nombre, tipo: d.tipo, x: n.position.x, y: n.position.y };
      }),
      transiciones: edges.map((e) => ({
        id: e.id.startsWith("nueva-") ? undefined : e.id,
        desdePasoId: e.source,
        haciaPasoId: e.target,
        etiqueta: String(e.label ?? "Continuar"),
      })),
    };
    try {
      const r = await fetch(`/api/correspondencia/flujos/${flujoId}/lienzo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        setError(j.error);
        setGuardando(false);
        return;
      }
      setSucio(false);
      setGuardando(false);
      router.refresh();
    } catch {
      setError("No se pudo guardar el diagrama.");
      setGuardando(false);
    }
  }

  const nodoSel = sel?.tipo === "nodo" ? nodes.find((n) => n.id === sel.id) : null;
  const edgeSel = sel?.tipo === "edge" ? edges.find((e) => e.id === sel.id) : null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-2">
        <span className="text-xs font-medium text-stone-500">Agregar:</span>
        {(["TAREA", "REVISION", "DECISION", "FIN"] as Tipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => agregar(t)}
            className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <Plus className="h-3 w-3" aria-hidden /> {ETIQUETA_TIPO[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {sucio && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="button"
            onClick={guardar}
            disabled={!sucio || guardando}
            className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cdmb-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" aria-hidden /> {guardando ? "Guardando…" : "Guardar diagrama"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_15rem]">
        <div className="h-[440px] border-b border-stone-100 lg:border-b-0 lg:border-r">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSel({ tipo: "nodo", id: n.id })}
            onEdgeClick={(_, e) => setSel({ tipo: "edge", id: e.id })}
            onPaneClick={() => setSel(null)}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-stone-50/50"
          >
            <Background gap={16} color="#e7e5e4" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="p-3 text-xs">
          {nodoSel ? (
            <div className="space-y-2">
              <p className="font-semibold text-stone-700">Paso seleccionado</p>
              <label className="block">
                <span className="mb-0.5 block text-stone-500">Nombre</span>
                <input
                  value={(nodoSel.data as unknown as DatosNodo).nombre}
                  onChange={(e) => editarNodo(nodoSel.id, { nombre: e.target.value })}
                  className="w-full rounded-md border border-stone-300 px-2 py-1"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-stone-500">Tipo</span>
                <select
                  value={(nodoSel.data as unknown as DatosNodo).tipo}
                  onChange={(e) => editarNodo(nodoSel.id, { tipo: e.target.value as Tipo })}
                  className="w-full rounded-md border border-stone-300 bg-white px-2 py-1"
                >
                  {(["TAREA", "REVISION", "DECISION", "FIN"] as Tipo[]).map((t) => (
                    <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={borrarSel} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Eliminar paso
              </button>
              <p className="text-stone-400">El responsable, el término y las instrucciones se editan en la lista de abajo.</p>
            </div>
          ) : edgeSel ? (
            <div className="space-y-2">
              <p className="font-semibold text-stone-700">Conexión seleccionada</p>
              <label className="block">
                <span className="mb-0.5 block text-stone-500">Opción (etiqueta)</span>
                <input
                  value={String(edgeSel.label ?? "")}
                  onChange={(e) => editarEdge(edgeSel.id, e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-2 py-1"
                  placeholder="Continuar / Aprobar / Devolver…"
                />
              </label>
              <button type="button" onClick={borrarSel} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Eliminar conexión
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-stone-500">
              <p className="font-semibold text-stone-700">Cómo usar el lienzo</p>
              <ul className="list-disc space-y-1 pl-4">
                <li><strong>Arrastre</strong> un paso para moverlo.</li>
                <li>Tire desde el <strong>punto de abajo</strong> de un paso hasta otro para <strong>conectarlos</strong>.</li>
                <li><strong>Clic</strong> en un paso o una flecha para editarlo o borrarlo.</li>
                <li>El paso <span className="text-cdmb-600">▶</span> es el inicial (se cambia el orden en la lista de abajo).</li>
              </ul>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex items-center gap-1 text-cdmb-700 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Recargar desde lo guardado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FlujoLienzo(props: { flujoId: string; pasos: PasoLienzo[]; transiciones: TransLienzo[] }) {
  // key estable por contenido: al guardar, router.refresh() cambia estas props y el editor
  // se re-monta con el estado fresco (sin ids temporales colgando).
  const clave = useMemo(
    () =>
      props.pasos.map((p) => `${p.id}:${p.nombre}:${p.tipo}:${p.posX}:${p.posY}:${p.orden}`).join("|") +
      "#" +
      props.transiciones.map((t) => `${t.id}:${t.desdePasoId}:${t.haciaPasoId}:${t.etiqueta}`).join("|"),
    [props.pasos, props.transiciones],
  );
  return (
    <ReactFlowProvider>
      <Editor key={clave} {...props} />
    </ReactFlowProvider>
  );
}
