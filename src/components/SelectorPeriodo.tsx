"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";

/**
 * Selector de período de un dashboard: por defecto Total (todo el
 * histórico); con las dos fechas + Aplicar se acota a ese rango con
 * calendario (mínimo un mes, se ajusta solo). Cambia la URL
 * (?desde=&hasta=), así que la página vuelve a renderizar en el servidor
 * con los datos ya filtrados — no hay estado que sincronizar aparte.
 */
export function SelectorPeriodo({ desdeActual, hastaActual }: { desdeActual?: string; hastaActual?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [desde, setDesde] = useState(desdeActual ?? "");
  const [hasta, setHasta] = useState(hastaActual ?? "");
  const activo = Boolean(desdeActual && hastaActual);

  function irA(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function aplicar() {
    if (!desde || !hasta) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("desde", desde);
    params.set("hasta", hasta);
    irA(params);
  }

  function quitar() {
    setDesde("");
    setHasta("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("desde");
    params.delete("hasta");
    irA(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        <CalendarRange className="h-4 w-4 text-cdmb-600" aria-hidden />
        Período
      </span>
      <input
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
        aria-label="Desde"
        className="rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-700 focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      />
      <span className="text-xs text-stone-400">a</span>
      <input
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
        aria-label="Hasta"
        className="rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-700 focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      />
      <button
        type="button"
        onClick={aplicar}
        disabled={!desde || !hasta}
        className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Aplicar
      </button>
      {activo ? (
        <button
          type="button"
          onClick={quitar}
          title="Quitar el filtro y volver a ver todo el histórico"
          className="flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition hover:bg-stone-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Ver total
        </button>
      ) : (
        <span className="text-xs text-stone-400">Sin filtro — mostrando todo el histórico. Mínimo un mes.</span>
      )}
    </div>
  );
}
