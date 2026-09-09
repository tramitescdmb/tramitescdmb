"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { aplicarMarcadores, marcadoresPendientes, type ContextoMarcadores } from "@/lib/plantillas-marcadores";

export type PlantillaOpcion = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  asunto: string | null;
  cuerpo: string;
};

/**
 * Carga una plantilla de documento (MoReq 3.30) en los campos de asunto y
 * contenido de un formulario. No radica nada: rellena los campos (aplicando los
 * marcadores que trae el contexto), que siguen siendo editables. Pide
 * confirmación si ya hay texto y avisa qué marcadores quedaron sin resolver.
 */
export function PlantillaSelector({
  plantillas,
  contexto = {},
  contenidoActual,
  asuntoActual = "",
  onCargar,
  onCargarAsunto,
}: {
  plantillas: PlantillaOpcion[];
  contexto?: ContextoMarcadores;
  contenidoActual: string;
  asuntoActual?: string;
  onCargar: (cuerpo: string) => void;
  onCargarAsunto?: (asunto: string) => void;
}) {
  const [sel, setSel] = useState("");
  const [pendientes, setPendientes] = useState<string[]>([]);
  if (plantillas.length === 0) return null;

  const seleccionada = plantillas.find((p) => p.id === sel);

  // Agrupa por categoría en <optgroup> si hay categorías.
  const porCategoria = new Map<string, PlantillaOpcion[]>();
  for (const p of plantillas) {
    const k = p.categoria ?? "";
    if (!porCategoria.has(k)) porCategoria.set(k, []);
    porCategoria.get(k)!.push(p);
  }

  function cargar() {
    if (!seleccionada) return;
    const hayTexto = contenidoActual.trim() || (asuntoActual.trim() && seleccionada.asunto);
    if (hayTexto && !window.confirm("Esto reemplazará lo que ya escribió. ¿Continuar?")) return;

    const cuerpo = aplicarMarcadores(seleccionada.cuerpo, contexto);
    onCargar(cuerpo);
    let asunto = "";
    if (seleccionada.asunto && onCargarAsunto) {
      asunto = aplicarMarcadores(seleccionada.asunto, contexto);
      onCargarAsunto(asunto);
    }
    setPendientes(marcadoresPendientes(`${asunto}\n${cuerpo}`));
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
        <FileText className="h-3.5 w-3.5" aria-hidden /> Cargar desde una plantilla
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          value={sel}
          onChange={(e) => { setSel(e.target.value); setPendientes([]); }}
          className="min-w-[220px] flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Ninguna —</option>
          {[...porCategoria.entries()].map(([cat, lista]) =>
            cat ? (
              <optgroup key={cat} label={cat}>
                {lista.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
              </optgroup>
            ) : (
              lista.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))
            )
          )}
        </select>
        <button
          type="button"
          disabled={!seleccionada}
          onClick={() => {
            cargar();
            if (seleccionada) {
              fetch(`/api/correspondencia/plantillas/${seleccionada.id}/usada`, { method: "POST" }).catch(() => {});
            }
          }}
          className="rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50 disabled:opacity-40"
        >
          Cargar
        </button>
      </div>
      {seleccionada?.descripcion && <p className="mt-1.5 text-[11px] text-stone-500">{seleccionada.descripcion}</p>}
      {pendientes.length > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Faltan por completar a mano: {pendientes.map((m) => `[${m}]`).join(", ")}
        </p>
      )}
    </div>
  );
}
