"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

export function MarcaRequiereFirma({ documentoId, marcado, puedeQuitar }: { documentoId: string; marcado: boolean; puedeQuitar: boolean }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(requiereFirma: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}/requiere-firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiereFirma }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo actualizar la marca.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (marcado && !puedeQuitar) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {marcado ? (
        <button
          type="button"
          onClick={() => cambiar(false)}
          disabled={guardando}
          title="Quitar la marca: el documento no irá a firma"
          className="text-[10px] font-medium text-stone-400 underline decoration-dotted hover:text-stone-700 disabled:opacity-50"
        >
          quitar marca
        </button>
      ) : (
        <button
          type="button"
          onClick={() => cambiar(true)}
          disabled={guardando}
          title="Avisa que este documento debe firmarse; el supervisor o el personal de contratación asigna los firmantes"
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          <PenLine className="h-3 w-3" aria-hidden />
          {guardando ? "Guardando…" : "Requiere firma"}
        </button>
      )}
      {error && <span className="text-[10px] text-red-700">{error}</span>}
    </span>
  );
}
