"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";

export function RetrocederEtapaBoton({ expedienteId, etiquetaAnterior }: { expedienteId: string; etiquetaAnterior: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retroceder() {
    const motivo = window.prompt(`Motivo para regresar a ${etiquetaAnterior} (obligatorio):`);
    if (motivo === null) return;
    if (!motivo.trim()) return setError("Debe indicar el motivo.");
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/retroceder-etapa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo retroceder la etapa.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={retroceder}
        disabled={cargando}
        title={`Regresar el expediente a ${etiquetaAnterior} — corrige un avance hecho por error`}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Regresando…" : `Regresar a ${etiquetaAnterior}`}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
