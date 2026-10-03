"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Loader2 } from "lucide-react";
import type { SerieBuscable } from "@/components/BuscadorSubserieTRD";
import { SelectorTrdContrato } from "@/components/SelectorTrdContrato";

export function ReclasificarTrdContratoForm({
  expedienteId,
  series,
  objeto,
  serieIdActual,
  subserieIdActual,
}: {
  expedienteId: string;
  series: SerieBuscable[];
  objeto: string;
  serieIdActual: string | null;
  subserieIdActual: string | null;
}) {
  const router = useRouter();
  const [serieId, setSerieId] = useState(serieIdActual ?? "");
  const [subserieId, setSubserieId] = useState(subserieIdActual ?? "");
  const [motivo, setMotivo] = useState(subserieIdActual ? "" : "Clasificación inicial del expediente");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambio = subserieId && subserieId !== subserieIdActual;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/trd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subserieId, motivo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar la clasificación.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <SelectorTrdContrato
        series={series}
        objeto={objeto}
        serieId={serieId}
        subserieId={subserieId}
        autoaplicar={!subserieIdActual}
        onChange={(s, ss) => {
          setSerieId(s);
          setSubserieId(ss);
        }}
      />
      {cambio && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1 text-xs">
            <span className="mb-1 block font-medium text-stone-600">Motivo</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !motivo.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FolderTree className="h-3.5 w-3.5" aria-hidden />}
            {subserieIdActual ? "Reclasificar" : "Guardar clasificación"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
