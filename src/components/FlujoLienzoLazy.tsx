"use client";

import dynamic from "next/dynamic";

/** Carga diferida del editor visual (React Flow pesa ~60 kB) — solo llega al
 * navegador de quien abre un flujo, no al bundle de todo el módulo. */
export const FlujoLienzo = dynamic(() => import("./FlujoLienzo").then((m) => m.FlujoLienzo), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-stone-200 bg-stone-50/60 text-sm text-stone-400">
      Cargando el editor visual…
    </div>
  ),
});
