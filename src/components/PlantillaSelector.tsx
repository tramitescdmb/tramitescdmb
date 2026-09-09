"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export type PlantillaOpcion = { id: string; nombre: string; descripcion: string | null; cuerpo: string };

/**
 * Selector para cargar una plantilla de documento (MoReq 3.30) en el campo de
 * contenido de un formulario. No radica nada: solo rellena el textarea, que
 * sigue siendo editable. Pide confirmación si ya hay texto escrito.
 */
export function PlantillaSelector({
  plantillas,
  contenidoActual,
  onCargar,
}: {
  plantillas: PlantillaOpcion[];
  contenidoActual: string;
  onCargar: (cuerpo: string) => void;
}) {
  const [sel, setSel] = useState("");
  if (plantillas.length === 0) return null;

  const seleccionada = plantillas.find((p) => p.id === sel);

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
        <FileText className="h-3.5 w-3.5" aria-hidden /> Cargar desde una plantilla
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Ninguna —</option>
          {plantillas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!seleccionada}
          onClick={() => {
            if (!seleccionada) return;
            if (contenidoActual.trim() && !window.confirm("Esto reemplazará el contenido que ya escribió. ¿Continuar?")) return;
            onCargar(seleccionada.cuerpo);
          }}
          className="rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50 disabled:opacity-40"
        >
          Cargar
        </button>
      </div>
      {seleccionada?.descripcion && <p className="mt-1.5 text-[11px] text-stone-500">{seleccionada.descripcion}</p>}
    </div>
  );
}
