"use client";

import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { sumarDiasHabiles, type CalendarioLaboral } from "@/lib/dias-habiles";

type Paso = { id: string; orden: number; nombre: string; tipo: string; slaDiasHabiles?: number | null };
type Trans = { desdePasoId: string; haciaPasoId: string; etiqueta: string };

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fechaCorta(d: Date) {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function FlujoSimulador({
  pasos,
  transiciones,
  calendario,
}: {
  pasos: Paso[];
  transiciones: Trans[];
  calendario?: { diasNoLaborables: string[]; diasSemana?: number[] };
}) {
  const cal: CalendarioLaboral = useMemo(
    () => ({ diasNoLaborables: new Set(calendario?.diasNoLaborables ?? []), diasSemana: calendario?.diasSemana }),
    [calendario],
  );
  const [inicio, setInicio] = useState(hoyIso);
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
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
      >
        <Play className="h-3.5 w-3.5" aria-hidden /> Simular el flujo
      </button>
    );
  }

  const fechaInicio = /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? new Date(`${inicio}T12:00:00Z`) : new Date();
  let acumulado = fechaInicio;
  let dias = 0;
  const filas = camino.map((c) => {
    const sla = c.paso.tipo === "FIN" ? 0 : (c.paso.slaDiasHabiles ?? 0);
    if (sla > 0) {
      acumulado = sumarDiasHabiles(acumulado, sla, cal);
      dias += sla;
    }
    return { ...c, sla, vence: sla > 0 ? acumulado : null };
  });
  const sinTermino = filas.filter((f) => f.paso.tipo !== "FIN" && !f.sla).length;

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">Simulación</p>
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          Inicia el
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded border border-stone-200 px-1.5 py-0.5 text-xs" />
        </label>
        <button type="button" onClick={reiniciar} className="inline-flex items-center gap-1 text-xs text-cdmb-700 hover:underline">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reiniciar
        </button>
      </div>
      <ol className="space-y-1 text-xs">
        {filas.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-cdmb-100 text-[10px] font-semibold text-cdmb-700">{c.paso.orden}</span>
            <strong className="text-stone-700">{c.paso.nombre}</strong>
            {c.resultado && <span className="text-cdmb-700">→ {c.resultado}</span>}
            {c.vence && (
              <span className="text-stone-400">
                · {c.sla} d. hábil{c.sla === 1 ? "" : "es"}, hasta el {fechaCorta(c.vence)}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-stone-600">
        Tiempo estimado del recorrido: <strong>{dias} día{dias === 1 ? "" : "s"} hábil{dias === 1 ? "" : "es"}</strong>
        {dias > 0 && <> · terminaría el {fechaCorta(acumulado)}</>}
        {sinTermino > 0 && <span className="text-amber-700"> · {sinTermino} paso{sinTermino === 1 ? "" : "s"} sin término sugerido</span>}
      </p>
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
              className="rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
            >
              {t.etiqueta} → {porId.get(t.haciaPasoId)?.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
