"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export function AprobarEtapaContratoBoton({
  expedienteId,
  etiquetaActual,
  etiquetaSiguiente,
}: {
  expedienteId: string;
  etiquetaActual: string;
  etiquetaSiguiente: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aprobar() {
    setCargando(true);
    setError(null);
    try {
      const comentario = window.prompt(`Cierre de la etapa ${etiquetaActual}. Comentario (opcional):`);
      if (comentario === null) return;
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/aprobar-etapa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(body.faltantes)) {
        const lista = body.faltantes.map((f: string) => `• ${f}`).join("\n");
        window.alert(
          `No se puede cerrar la etapa ${etiquetaActual}. Documentos obligatorios pendientes:\n\n${lista}\n\nLos documentos ya subidos que no estén validados se aprueban al cerrar la etapa.`
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
        title={`Cierra ${etiquetaActual} y aprueba los documentos subidos de esa etapa`}
        className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-600 disabled:opacity-60"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Aprobando…" : `Cerrar ${etiquetaActual} → ${etiquetaSiguiente}`}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
