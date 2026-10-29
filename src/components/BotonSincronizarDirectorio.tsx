"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function BotonSincronizarDirectorio({ usuarioId, ultima }: { usuarioId: string; ultima: string | null }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function sincronizar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}/sincronizar-directorio`, { method: "POST" });
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
    <>
      <button
        type="button"
        onClick={sincronizar}
        disabled={enviando}
        title={ultima ? `Última sincronización: ${ultima}` : "Trae los datos del directorio activo por la cédula del usuario"}
        className="inline-flex flex-none items-center gap-1.5 rounded border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${enviando ? "animate-spin" : ""}`} aria-hidden />
        Sincronizar con el directorio
      </button>
      {mensaje && (
        <p className={`order-last basis-full rounded-md px-3 py-1.5 text-xs ${mensaje.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{mensaje.texto}</p>
      )}
    </>
  );
}
