"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SincronizarContratistaBoton({ contratistaId }: { contratistaId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function sincronizar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratistaId}/sincronizar-directorio`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMensaje({ ok: res.ok, texto: data.mensaje || data.error || "No se pudo sincronizar." });
      if (res.ok) router.refresh();
    } catch {
      setMensaje({ ok: false, texto: "No se pudo sincronizar." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={sincronizar}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${enviando ? "animate-spin" : ""}`} aria-hidden />
        Sincronizar con el directorio
      </button>
      {mensaje && <span className={`max-w-md text-xs ${mensaje.ok ? "text-emerald-700" : "text-amber-800"}`}>{mensaje.texto}</span>}
    </span>
  );
}
