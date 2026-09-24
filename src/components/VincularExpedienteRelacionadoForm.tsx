"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

export function VincularExpedienteRelacionadoForm({
  expedienteId,
  opciones,
  actualId,
}: {
  expedienteId: string;
  opciones: { id: string; numero: string; objeto: string }[];
  actualId: string | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(actualId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expedienteRelacionadoId: valor || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="rounded-md border border-stone-200 px-2 py-1 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      >
        <option value="">Ninguno</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.numero} — {o.objeto.slice(0, 40)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={guardar}
        disabled={guardando || valor === (actualId ?? "")}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
      >
        <Link2 className="h-3 w-3" aria-hidden />
        Guardar
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
