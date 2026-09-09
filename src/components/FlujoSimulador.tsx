"use client";

import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";

/**
 * Simulador de flujo (MoReq 7.5): recorre el flujo desde el paso inicial sin
 * tocar nada. En cada paso con varias salidas se elige la opción; el resultado
 * es el camino que seguiría una comunicación real. Puro cliente.
 */
type Paso = { id: string; orden: number; nombre: string; tipo: string };
type Trans = { desdePasoId: string; haciaPasoId: string; etiqueta: string };

export function FlujoSimulador({ pasos, transiciones }: { pasos: Paso[]; transiciones: Trans[] }) {
  const ordenados = useMemo(() => [...pasos].sort((a, b) => a.orden - b.orden), [pasos]);
  const porId = useMemo(() => new Map(pasos.map((p) => [p.id, p])), [pasos]);
  const salidas = useMemo(
    () => (pasoId: string) => transiciones.filter((t) => t.desdePasoId === pasoId),
    [transiciones],
  );

  const inicial = ordenados[0];
  const [camino, setCamino] = useState<{ paso: Paso; resultado?: string }[]>(inicial ? [{ paso: inicial }] : []);
  const [activo, setActivo] = useState(false);

  if (!inicial) return null;
  const ultimo = camino[camino.length - 1];
  const opciones = ultimo && ultimo.paso.tipo !== "FIN" ? salidas(ultimo.paso.id) : [];
  const terminado = !ultimo || ultimo.paso.tipo === "FIN" || opciones.length === 0;

  function elegir(t: Trans) {
    const destino = porId.get(t.haciaPasoId);
    if (!destino) return;
    setCamino((c) => {
      const nuevo = [...c];
      nuevo[nuevo.length - 1] = { ...nuevo[nuevo.length - 1], resultado: t.etiqueta };
      nuevo.push({ paso: destino });
      // corta ciclos infinitos: máximo 30 pasos en la simulación
      return nuevo.slice(0, 30);
    });
  }

  function reiniciar() {
    setCamino([{ paso: inicial }]);
  }

  if (!activo) {
    return (
      <button
        type="button"
        onClick={() => setActivo(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
      >
        <Play className="h-3.5 w-3.5" aria-hidden /> Simular el flujo
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-900">Simulación</p>
        <button type="button" onClick={reiniciar} className="inline-flex items-center gap-1 text-xs text-cdmb-700 hover:underline">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reiniciar
        </button>
      </div>
      <ol className="space-y-1 text-xs">
        {camino.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-cdmb-100 text-[10px] font-semibold text-cdmb-700">{c.paso.orden}</span>
            <strong className="text-stone-700">{c.paso.nombre}</strong>
            {c.resultado && <span className="text-cdmb-700">→ {c.resultado}</span>}
          </li>
        ))}
      </ol>
      {terminado ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          {ultimo?.paso.tipo === "FIN" ? "El flujo termina aquí." : "No hay más salidas desde este paso."}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {opciones.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => elegir(t)}
              className="rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
            >
              {t.etiqueta} → {porId.get(t.haciaPasoId)?.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
