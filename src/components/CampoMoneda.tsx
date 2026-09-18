"use client";

import { useRef } from "react";
import { formatearMilesCO, limpiarNumero } from "@/lib/moneda";

/**
 * Input de valor monetario: muestra separador de miles mientras se escribe
 * (es-CO) y expone hacia afuera el valor numérico crudo, sin formato — el
 * formulario nunca envía el texto con puntos, solo dígitos.
 *
 * Reposiciona el cursor manualmente tras cada tecla: al ser un input controlado
 * que se REFORMATEA en cada cambio (se insertan/quitan puntos de miles), el
 * navegador por defecto deja el cursor al final del valor formateado — para
 * contratos cuantiosos (muchos dígitos) eso hacía que, al seguir escribiendo,
 * los dígitos nuevos no quedaran donde se esperaba y diera la sensación de que
 * el campo "no dejaba escribir más" pasado cierto punto.
 */
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

    // El valor formateado que se ve en pantalla depende del `value` que llega por props
    // (lo recalcula el padre) — se reubica el cursor después del próximo pintado.
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
