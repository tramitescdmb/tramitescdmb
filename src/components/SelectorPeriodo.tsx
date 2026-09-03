"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

const OPCIONES = [
  { valor: "total", etiqueta: "Total (todo el histórico)" },
  { valor: "1m", etiqueta: "Último mes" },
  { valor: "3m", etiqueta: "Últimos 3 meses" },
  { valor: "6m", etiqueta: "Últimos 6 meses" },
  { valor: "1a", etiqueta: "Último año" },
  { valor: "2a", etiqueta: "Últimos 2 años" },
  { valor: "4a", etiqueta: "Últimos 4 años" },
  { valor: "personalizado", etiqueta: "Personalizado…" },
];

/**
 * Selector de período de un dashboard: atajos (mes/años) + un rango con
 * calendario para revisar por vigencias específicas. Cambia la URL
 * (?periodo=&desde=&hasta=), así que la página vuelve a renderizar en el
 * servidor con los datos ya filtrados — no hay estado que sincronizar aparte.
 */
export function SelectorPeriodo({ valorActual, desdeActual, hastaActual }: { valorActual: string; desdeActual?: string; hastaActual?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mostrarCalendario, setMostrarCalendario] = useState(valorActual === "personalizado");
  const [desde, setDesde] = useState(desdeActual ?? "");
  const [hasta, setHasta] = useState(hastaActual ?? "");

  function irA(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function cambiarOpcion(v: string) {
    if (v === "personalizado") {
      setMostrarCalendario(true);
      return;
    }
    setMostrarCalendario(false);
    const params = new URLSearchParams(searchParams.toString());
    if (v === "total") params.delete("periodo");
    else params.set("periodo", v);
    params.delete("desde");
    params.delete("hasta");
    irA(params);
  }

  function aplicarPersonalizado() {
    if (!desde || !hasta) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", "personalizado");
    params.set("desde", desde);
    params.set("hasta", hasta);
    irA(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        <CalendarRange className="h-4 w-4 text-cdmb-600" aria-hidden />
        Período
      </span>
      <select
        value={valorActual}
        onChange={(e) => cambiarOpcion(e.target.value)}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {mostrarCalendario && (
        <>
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
            onClick={aplicarPersonalizado}
            disabled={!desde || !hasta}
            className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
          <span className="text-xs text-stone-400">Mínimo un mes — un rango más corto se ajusta.</span>
        </>
      )}
    </div>
  );
}
