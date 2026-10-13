"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function BotonSincronizarSecop({ expedienteId, enlazado }: { expedienteId: string; enlazado: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sincronizar(e: React.MouseEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/secop`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo sincronizar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="max-w-xs text-[11px] text-red-700">{error}</span>}
      <button
        type="button"
        onClick={sincronizar}
        disabled={cargando}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} aria-hidden />
        {cargando ? "Consultando…" : enlazado ? "Actualizar" : "Enlazar con SECOP II"}
      </button>
    </span>
  );
}
