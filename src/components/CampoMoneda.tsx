"use client";

import { formatearMilesCO, limpiarNumero } from "@/lib/moneda";

/**
 * Input de valor monetario: muestra separador de miles mientras se escribe
 * (es-CO) y expone hacia afuera el valor numérico crudo, sin formato — el
 * formulario nunca envía el texto con puntos, solo dígitos.
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
  return (
    <div className={`flex items-center rounded-lg border border-stone-200 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500 ${className ?? ""}`}>
      <span className="pl-3 text-sm text-stone-400">$</span>
      <input
        inputMode="numeric"
        value={formatearMilesCO(value)}
        onChange={(e) => onChange(limpiarNumero(e.target.value))}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-2 text-sm outline-none"
      />
      <span className="pr-3 text-xs text-stone-400">COP</span>
    </div>
  );
}
