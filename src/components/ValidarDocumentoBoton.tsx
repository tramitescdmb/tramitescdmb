"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Undo2 } from "lucide-react";

export function ValidarDocumentoBoton({
  documentoId,
  nombre,
  endpoint = `/api/contratacion/documentos/${documentoId}/validar`,
  permitirDevolver = false,
}: {
  documentoId: string;
  nombre: string;
  endpoint?: string;
  /** Muestra "Devolver" para rechazar con observaciones (GECON, Precontractual). */
  permitirDevolver?: boolean;
}) {
  const router = useRouter();
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validar() {
    if (!window.confirm(`¿Marcar "${nombre}" como validado? Confirma que ya se revisó y cumple lo exigido.`)) return;
    setValidando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo validar el documento.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setValidando(false);
    }
  }

  async function devolver() {
    const observaciones = window.prompt(`¿Qué debe corregirse en "${nombre}"? Quien lo subió recibirá este mensaje.`);
    if (observaciones === null) return;
    if (!observaciones.trim()) {
      setError("Escriba qué debe corregirse.");
      return;
    }
    setValidando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "devolver", observaciones }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo devolver el documento.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setValidando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={validar}
        disabled={validando}
        title="Marcar este documento como validado"
        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        {validando ? "Validando…" : "Validar"}
      </button>
      {permitirDevolver && (
        <button
          type="button"
          onClick={devolver}
          disabled={validando}
          title="Devolver con observaciones para que suban una versión corregida"
          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          Devolver
        </button>
      )}
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
