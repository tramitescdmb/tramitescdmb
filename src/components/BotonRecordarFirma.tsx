"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";

/** Recuerda a un firmante pendiente (cuyo turno ya llegó) que falta su firma: buzón, inicio y correo. */
export function BotonRecordarFirma({ solicitudId, nombre }: { solicitudId: string; nombre: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function recordar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/firmas/recordar-pendiente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ solicitudId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo enviar el recordatorio.");
      setMensaje(body.avisado ? "Recordatorio enviado" : "Ya se le recordó hace poco");
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
        onClick={recordar}
        disabled={enviando}
        title={`Le recuerda a ${nombre} que falta su firma: le aparece en su buzón e inicio y le llega un correo`}
        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        <BellRing className="h-3 w-3" aria-hidden />
        {enviando ? "Enviando…" : "Recordar"}
      </button>
      {mensaje && <span className="text-[10px] text-stone-500">{mensaje}</span>}
    </span>
  );
}
