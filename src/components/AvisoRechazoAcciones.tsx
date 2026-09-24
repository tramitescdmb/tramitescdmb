"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Descarta (borra) un aviso de documento rechazado del buzón — se limpia solo cuando se reemplaza
 * el archivo rechazado, pero la persona también puede descartarlo a mano en cualquier momento.
 * `endpoint` es la base de la ruta (sin el id) — cada módulo tiene la suya. */
export function AvisoRechazoAcciones({ avisoId, endpoint = "/api/contratacion/avisos-rechazo" }: { avisoId: string; endpoint?: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descartar() {
    setBorrando(true);
    setError(null);
    try {
      const res = await fetch(`${endpoint}/${avisoId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo descartar el aviso.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setBorrando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={descartar}
        disabled={borrando}
        title="Descartar este aviso"
        className="flex-none rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
