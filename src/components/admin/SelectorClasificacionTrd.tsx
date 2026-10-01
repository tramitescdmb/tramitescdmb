"use client";

import { useState } from "react";

type Opcion = { id: string; etiqueta: string };
type Grupo = { dependencia: string; subseries: Opcion[] };

export function SelectorClasificacionTrd({
  tipo,
  id,
  valorInicial,
  opciones,
  grupos,
  placeholder = "— Sin clasificar —",
  deshabilitado = false,
}: {
  tipo: "tramiteTipo" | "documentoRequerido" | "requisitoContratacion" | "configuracion";
  id?: string;
  valorInicial: string | null;
  opciones?: Opcion[];
  grupos?: Grupo[];
  placeholder?: string;
  deshabilitado?: boolean;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(nuevo: string) {
    const anterior = valor;
    setValor(nuevo);
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/trd-clasificacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, valor: nuevo || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar.");
      }
    } catch (e) {
      setValor(anterior);
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={valor}
        disabled={deshabilitado || guardando}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-[220px] rounded-md border border-stone-200 px-2 py-1 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500 disabled:bg-stone-50 disabled:text-stone-400"
      >
        <option value="">{placeholder}</option>
        {grupos
          ? grupos.map((g) => (
              <optgroup key={g.dependencia} label={g.dependencia}>
                {g.subseries.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.etiqueta}
                  </option>
                ))}
              </optgroup>
            ))
          : opciones?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
      </select>
      {guardando && <span className="text-[10px] text-stone-400">Guardando…</span>}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
