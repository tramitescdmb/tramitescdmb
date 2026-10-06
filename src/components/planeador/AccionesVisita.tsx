"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Ban } from "lucide-react";

export function AccionesVisita({ visitaId, puedeMarcar, puedeCancelar }: { visitaId: string; puedeMarcar: boolean; puedeCancelar: boolean }) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(cuerpo: Record<string, string>) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setCancelando(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const boton = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50";

  return (
    <>
      {puedeMarcar && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => enviar({ accion: "realizada" })}
          className={`${boton} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
        >
          <Check className="h-3 w-3" aria-hidden />
          Realizada
        </button>
      )}
      {puedeCancelar && !cancelando && (
        <button type="button" disabled={ocupado} onClick={() => setCancelando(true)} className={`${boton} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}>
          <Ban className="h-3 w-3" aria-hidden />
          Cancelar
        </button>
      )}
      {cancelando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar({ accion: "cancelar", motivo });
          }}
          className="flex w-full flex-wrap items-center gap-1.5"
        >
          <input
            autoFocus
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la cancelación"
            className="min-w-0 flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs"
          />
          <button type="submit" disabled={ocupado} className={`${boton} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
            Confirmar
          </button>
          <button type="button" onClick={() => setCancelando(false)} className="text-[11px] text-stone-400 hover:text-stone-600">
            Volver
          </button>
        </form>
      )}
      {error && <p className="w-full text-[11px] text-red-700">{error}</p>}
    </>
  );
}
