"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export function AprobarEtapaContratoBoton({ expedienteId, etiquetaSiguiente }: { expedienteId: string; etiquetaSiguiente: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aprobar() {
    setCargando(true);
    setError(null);
    try {
      const comentario = window.prompt("Comentario de la aprobación (opcional):") ?? undefined;
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/aprobar-etapa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(body.faltantes)) {
        const lista = body.faltantes.map((f: string) => `• ${f}`).join("\n");
        window.alert(
          `No se puede aprobar: estos documentos obligatorios del catálogo de esta etapa no están subidos y validados:\n\n${lista}\n\nSúbalos y valídelos antes de continuar.`
        );
        return;
      }
      if (!res.ok) throw new Error(body.error || "No se pudo aprobar la etapa.");
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
        onClick={aprobar}
        disabled={cargando}
        className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-600 disabled:opacity-60"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Aprobando…" : `Aprobar paso a ${etiquetaSiguiente}`}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
