"use client";

import { useState } from "react";
import { BuscadorSubserieTRD, type SerieBuscable } from "@/components/BuscadorSubserieTRD";

// Igual que SelectorClasificacionTrd (autosave por fila, PATCH /api/admin/trd-clasificacion) pero para
// elegir una SUBSERIE completa con el buscador en cascada dependencia → serie → subserie, en vez de un
// <select> plano — evita la ambigüedad de series con el mismo nombre repetidas entre dependencias.
export function SelectorSubserieTrdCascada({
  tipo,
  id,
  valorInicial,
  series,
}: {
  tipo: "tramiteTipo" | "configuracion" | "modalidad";
  id?: string;
  valorInicial: string | null;
  series: SerieBuscable[];
}) {
  const serieInicial = series.find((s) => s.subseries.some((sub) => sub.id === valorInicial));
  const [serieId, setSerieId] = useState(serieInicial?.id ?? "");
  const [subserieId, setSubserieId] = useState(valorInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(nuevaSerieId: string, nuevaSubserieId: string) {
    const anterior = subserieId;
    setSerieId(nuevaSerieId);
    setSubserieId(nuevaSubserieId);
    if (!nuevaSubserieId) return; // elegir solo la serie todavía no guarda nada
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/trd-clasificacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, valor: nuevaSubserieId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar.");
      }
    } catch (e) {
      setSubserieId(anterior);
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md space-y-1">
      <BuscadorSubserieTRD series={series} serieId={serieId} subserieId={subserieId} onChange={cambiar} />
      {guardando && <p className="text-[10px] text-stone-400">Guardando…</p>}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
