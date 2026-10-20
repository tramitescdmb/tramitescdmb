"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLayoutDashboard, IconMaximize, IconMinimize, IconRefresh } from "@tabler/icons-react";

import type { OpcionTablero } from "@/lib/tableros";

export type { OpcionTablero };

export function SelectorTablero({ opciones, actual }: { opciones: OpcionTablero[]; actual: string }) {
  const router = useRouter();
  const propias = opciones.filter((o) => !o.grupo);
  const grupos = [...new Set(opciones.filter((o) => o.grupo).map((o) => o.grupo as string))];

  return (
    <label className="flex items-center gap-2">
      <IconLayoutDashboard className="h-5 w-5 text-stone-500" stroke={1.75} aria-hidden />
      <span className="sr-only">Tablero</span>
      <select
        value={actual}
        onChange={(e) => router.push(e.target.value)}
        className="h-9 min-w-[14rem] rounded border border-stone-300 bg-white px-3 text-[15px] font-medium text-stone-800"
      >
        {propias.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {opciones
              .filter((o) => o.grupo === g)
              .map((o) => (
                <option key={o.href} value={o.href}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function AccionesTablero() {
  const router = useRouter();
  const [refrescando, iniciar] = useTransition();

  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const alCambiar = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  function pantallaCompleta(e: React.MouseEvent<HTMLButtonElement>) {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = e.currentTarget.closest("main") ?? document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
  }

  const boton = "flex h-9 w-9 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => iniciar(() => router.refresh())} title="Actualizar cifras" aria-label="Actualizar cifras" className={boton}>
        <IconRefresh className={`h-5 w-5 ${refrescando ? "animate-spin" : ""}`} stroke={1.75} aria-hidden />
      </button>
      <button type="button" onClick={pantallaCompleta} title={completa ? "Salir de pantalla completa" : "Pantalla completa"} aria-label={completa ? "Salir de pantalla completa" : "Pantalla completa"} className={boton}>
        {completa ? <IconMinimize className="h-5 w-5" stroke={1.75} aria-hidden /> : <IconMaximize className="h-5 w-5" stroke={1.75} aria-hidden />}
      </button>
    </div>
  );
}
