"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";

export function BotonAvisarFirmantes({ solicitudId }: { solicitudId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function avisar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/firmas/recordar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ solicitudId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo enviar el aviso.");
      setMensaje(body.avisados?.length ? "Aviso enviado" : "Ya se avisó hace poco");
      router.refresh();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={avisar}
        disabled={enviando}
        title="Le aparecerá en su inicio y en su buzón que usted espera su firma"
        className="inline-flex items-center gap-1 rounded-md border border-cdmb-200 bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700 hover:bg-cdmb-100 disabled:opacity-50"
      >
        <BellRing className="h-3 w-3" aria-hidden />
        {enviando ? "Avisando…" : "Avisar"}
      </button>
      {mensaje && <span className="text-[10px] text-stone-500">{mensaje}</span>}
    </span>
  );
}
