"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function ReabrirConcepto({ visitaId }: { visitaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reabrir() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/reabrir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo reabrir el concepto.");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Reabrir para corrección
      </button>
      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Reabrir el concepto técnico</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-stone-700">Se retiran las firmas pendientes y el PDF actual queda en el expediente como versión reemplazada. Al corregir, se vuelve a dar por terminado y a enviar a firma.</p>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} placeholder="Motivo de la reapertura" aria-label="Motivo de la reapertura" className="mt-3 w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm" />
            {error && <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                Cancelar
              </button>
              <button type="button" onClick={reabrir} disabled={enviando || !motivo.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60">
                {enviando && <Spinner claro />}
                Reabrir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
