"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function RecordarFirmasConcepto({ visitaId }: { visitaId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function recordar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/recordar-firmas`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo enviar el recordatorio.");
      const partes = [
        body.avisados?.length ? `Recordatorio enviado a ${body.avisados.join(", ")}.` : "",
        body.yaAvisados?.length ? `A ${body.yaAvisados.join(", ")} ya se le recordó en las últimas 4 horas.` : "",
      ];
      setMensaje(partes.filter(Boolean).join(" "));
      router.refresh();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={recordar}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-200 bg-cdmb-50 px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-100 disabled:opacity-60"
      >
        {enviando ? <Spinner /> : <BellRing className="h-3.5 w-3.5" aria-hidden />}
        Recordar a quien tiene el turno
      </button>
      {mensaje && <span className="text-xs text-stone-600">{mensaje}</span>}
    </span>
  );
}
