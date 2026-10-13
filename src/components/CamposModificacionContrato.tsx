"use client";

import { TIPOS_MODIFICACION, cambiaPlazo, cambiaValor, type TipoModificacion } from "@/lib/modificaciones-contrato";

export type ValorModificacion = { tipo: TipoModificacion | ""; fechaTerminacion: string; valorAdicionado: string };

export const MODIFICACION_VACIA: ValorModificacion = { tipo: "", fechaTerminacion: "", valorAdicionado: "" };

export function faltaEnModificacion(v: ValorModificacion): string | null {
  if (!v.tipo) return "Indique el tipo de modificación del contrato.";
  if (cambiaPlazo(v.tipo) && !v.fechaTerminacion) return "Indique la nueva fecha de terminación.";
  if (cambiaValor(v.tipo) && !(Number(v.valorAdicionado) > 0)) return "Indique el valor adicionado.";
  return null;
}

export function CamposModificacionContrato({
  valor,
  onChange,
  fechaTerminacionActual,
}: {
  valor: ValorModificacion;
  onChange: (v: ValorModificacion) => void;
  fechaTerminacionActual: string | null;
}) {
  const campo = "rounded-md border border-stone-200 bg-white px-2 py-1 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs">
      <p className="font-medium text-amber-900">Modificación del contrato</p>
      <select value={valor.tipo} onChange={(e) => onChange({ ...valor, tipo: e.target.value as TipoModificacion | "" })} className={`${campo} w-full`}>
        <option value="">Seleccione el tipo…</option>
        {TIPOS_MODIFICACION.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.etiqueta}
          </option>
        ))}
      </select>
      {valor.tipo && cambiaPlazo(valor.tipo) && (
        <label className="flex flex-wrap items-center gap-2 text-stone-700">
          Nueva fecha de terminación
          <input
            type="date"
            value={valor.fechaTerminacion}
            min={fechaTerminacionActual ?? undefined}
            onChange={(e) => onChange({ ...valor, fechaTerminacion: e.target.value })}
            className={campo}
          />
          {fechaTerminacionActual && <span className="text-stone-400">Actual: {fechaTerminacionActual}</span>}
        </label>
      )}
      {valor.tipo && cambiaValor(valor.tipo) && (
        <label className="flex flex-wrap items-center gap-2 text-stone-700">
          Valor adicionado ($)
          <input
            type="number"
            min={1}
            step={1}
            value={valor.valorAdicionado}
            onChange={(e) => onChange({ ...valor, valorAdicionado: e.target.value })}
            className={`${campo} w-40`}
          />
        </label>
      )}
    </div>
  );
}

export function cuerpoModificacion(v: ValorModificacion) {
  return v.tipo ? { tipo: v.tipo, fechaTerminacion: v.fechaTerminacion || null, valorAdicionado: Number(v.valorAdicionado) || null } : undefined;
}
