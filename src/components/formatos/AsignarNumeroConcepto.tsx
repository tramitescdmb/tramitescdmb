"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function AsignarNumeroConcepto({ visitaId }: { visitaId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function asignar() {
    if (!window.confirm("¿Asignar ahora el número consecutivo del concepto técnico? La fecha del concepto será la de hoy y el número no se puede cambiar.")) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/concepto`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo asignar el número.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={asignar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60">
        {enviando ? <Spinner claro /> : <Hash className="h-3.5 w-3.5" aria-hidden />}
        Asignar número de concepto
      </button>
      {error && <span className="max-w-sm text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
