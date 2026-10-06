"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleSlash } from "lucide-react";

type Accion = "cancelar" | "no_realizada";

const TEXTOS: Record<Accion, { boton: string; placeholder: string }> = {
  cancelar: { boton: "Cancelar", placeholder: "Motivo de la cancelación" },
  no_realizada: { boton: "No realizada", placeholder: "Por qué no se pudo realizar (sin acceso, no atendieron…)" },
};

export function AccionesVisita({ visitaId, puedeNoRealizada, puedeCancelar }: { visitaId: string; puedeNoRealizada: boolean; puedeCancelar: boolean }) {
  const router = useRouter();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!accion) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, motivo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setAccion(null);
      setMotivo("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const boton = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50";

  if (accion) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex w-full flex-wrap items-center gap-1.5"
      >
        <input
          autoFocus
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={TEXTOS[accion].placeholder}
          className="min-w-0 flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs"
        />
        <button type="submit" disabled={ocupado} className={`${boton} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
          Confirmar
        </button>
        <button type="button" onClick={() => setAccion(null)} className="text-[11px] text-stone-400 hover:text-stone-600">
          Volver
        </button>
        {error && <p className="w-full text-[11px] text-red-700">{error}</p>}
      </form>
    );
  }

  return (
    <>
      {puedeNoRealizada && (
        <button type="button" onClick={() => setAccion("no_realizada")} className={`${boton} border-amber-200 bg-white text-amber-800 hover:bg-amber-50`}>
          <CircleSlash className="h-3 w-3" aria-hidden />
          {TEXTOS.no_realizada.boton}
        </button>
      )}
      {puedeCancelar && (
        <button type="button" onClick={() => setAccion("cancelar")} className={`${boton} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}>
          <Ban className="h-3 w-3" aria-hidden />
          {TEXTOS.cancelar.boton}
        </button>
      )}
    </>
  );
}
