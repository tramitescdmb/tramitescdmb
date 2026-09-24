"use client";

import dynamic from "next/dynamic";

export const FlujoLienzo = dynamic(() => import("./FlujoLienzo").then((m) => m.FlujoLienzo), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-stone-200 bg-stone-50/60 text-sm text-stone-400">
      Cargando el editor visual…
    </div>
  ),
});
