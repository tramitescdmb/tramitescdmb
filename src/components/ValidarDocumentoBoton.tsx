"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";

export function ValidarDocumentoBoton({
  documentoId,
  nombre,
  endpoint = `/api/contratacion/documentos/${documentoId}/validar`,
}: {
  documentoId: string;
  nombre: string;
  endpoint?: string;
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

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={validar}
        disabled={validando}
        title="Marcar este documento como validado"
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        {validando ? "Validando…" : "Validar"}
      </button>
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
