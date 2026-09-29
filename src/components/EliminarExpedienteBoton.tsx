"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

export function EliminarExpedienteBoton({
  expedienteId,
  numero,
  numeroContrato,
}: {
  expedienteId: string;
  numero: string;
  numeroContrato?: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coincide = escrito.trim() === numero || (Boolean(numeroContrato) && escrito.trim() === numeroContrato);
  const puedeConfirmar = coincide && motivo.trim().length > 0;

  async function eliminar() {
    if (!puedeConfirmar) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar el expediente.");
      router.push("/contratacion/expedientes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Eliminar este expediente (queda oculto de los listados, pero consultable en la auditoría)"
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Eliminar expediente
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Eliminar expediente {numero}</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mb-3 text-xs text-stone-500">
              El expediente deja de aparecer en listados, búsquedas y reportes, pero queda registrado en la bitácora
              de auditoría junto con el motivo. Documentos y firmas no se borran.
            </p>

            <label className="mb-2 block text-xs font-medium text-stone-600">
              Escriba el número del expediente{numeroContrato ? " o del contrato" : ""} para confirmar
              <input
                type="text"
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
                placeholder={numero}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="mb-3 block text-xs font-medium text-stone-600">
              Motivo de la eliminación (obligatorio)
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={eliminar}
              disabled={!puedeConfirmar || cargando}
              className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cargando ? "Eliminando…" : "Eliminar expediente"}
            </button>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
