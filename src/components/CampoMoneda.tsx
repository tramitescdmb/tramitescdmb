"use client";

import { useRef } from "react";
import { formatearMilesCO, limpiarNumero } from "@/lib/moneda";

export function CampoMoneda({
  value,
  onChange,
  placeholder = "0",
  className,
}: {
  value: string;
  onChange: (valorCrudo: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function manejarCambio(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const cursorAntes = input.selectionStart ?? input.value.length;
    const digitosAntesDelCursor = input.value.slice(0, cursorAntes).replace(/[^\d]/g, "").length;

    onChange(limpiarNumero(input.value));

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const formateado = el.value;
      if (digitosAntesDelCursor === 0) {
        el.setSelectionRange(0, 0);
        return;
      }
      let vistos = 0;
      let posicion = formateado.length;
      for (let i = 0; i < formateado.length; i++) {
        if (/\d/.test(formateado[i]!)) {
          vistos++;
          if (vistos === digitosAntesDelCursor) {
            posicion = i + 1;
            break;
          }
        }
      }
      el.setSelectionRange(posicion, posicion);
    });
  }

  return (
    <div className={`flex items-center rounded-lg border border-stone-200 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500 ${className ?? ""}`}>
      <span className="pl-3 text-sm text-stone-400">$</span>
      <input
        ref={inputRef}
        inputMode="numeric"
        value={formatearMilesCO(value)}
        onChange={manejarCambio}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-2 text-sm outline-none"
      />
      <span className="pr-3 text-xs text-stone-400">COP</span>
    </div>
  );
}
