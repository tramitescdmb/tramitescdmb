"use client";

import { useRouter } from "next/navigation";
import { IconLayoutDashboard } from "@tabler/icons-react";

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
