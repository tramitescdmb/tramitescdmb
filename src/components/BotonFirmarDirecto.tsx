"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool } from "lucide-react";

export function BotonFirmarDirecto({ endpoint, descripcion }: { endpoint: string; descripcion: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function firmar() {
    if (!window.confirm(`${descripcion}\n\n¿Confirma su firma electrónica?`)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo registrar la firma.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={firmar}
        disabled={cargando}
        className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
      >
        <PenTool className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Firmando…" : "Firmar"}
      </button>
      {error && <span className="max-w-xs text-xs text-red-700">{error}</span>}
    </span>
  );
}
