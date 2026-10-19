"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLayoutDashboard, IconMaximize, IconRefresh } from "@tabler/icons-react";

export type OpcionTablero = { href: string; label: string; grupo?: string };

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

  function pantallaCompleta() {
    const el = document.getElementById("tablero");
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  const boton = "flex h-9 w-9 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => iniciar(() => router.refresh())} title="Actualizar cifras" aria-label="Actualizar cifras" className={boton}>
        <IconRefresh className={`h-5 w-5 ${refrescando ? "animate-spin" : ""}`} stroke={1.75} aria-hidden />
      </button>
      <button type="button" onClick={pantallaCompleta} title="Pantalla completa" aria-label="Pantalla completa" className={boton}>
        <IconMaximize className="h-5 w-5" stroke={1.75} aria-hidden />
      </button>
    </div>
  );
}
