"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, UploadCloud, X } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";

export function VerificacionSecopControl({
  documentoId,
  verificacionRecepcionEn,
  verificacionRecepcionPorNombre,
  verificacionRecepcionObservaciones,
  cargadoEnSecop,
  cargadoEnSecopEn,
  puedeGestionar,
}: {
  documentoId: string;
  verificacionRecepcionEn: Date | null;
  verificacionRecepcionPorNombre: string | null;
  verificacionRecepcionObservaciones: string | null;
  cargadoEnSecop: boolean;
  cargadoEnSecopEn: Date | null;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verificar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}/verificar-recepcion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observaciones: observaciones.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo verificar el documento.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  async function marcarCargado(cargado: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}/cargado-secop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargado }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo actualizar el estado.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  if (cargadoEnSecop) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
        title={cargadoEnSecopEn ? `Cargado en SECOP el ${formatearFechaHora(cargadoEnSecopEn)}` : "Cargado en SECOP"}
      >
        <UploadCloud className="h-2.5 w-2.5" aria-hidden />
        Cargado en SECOP
        {puedeGestionar && (
          <button type="button" onClick={() => marcarCargado(false)} disabled={cargando} className="ml-0.5 underline decoration-dotted hover:text-emerald-900">
            deshacer
          </button>
        )}
      </span>
    );
  }

  if (verificacionRecepcionEn) {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
          title={`Verificado por ${verificacionRecepcionPorNombre ?? "—"} el ${formatearFechaHora(verificacionRecepcionEn)}${
            verificacionRecepcionObservaciones ? `\nObservaciones: ${verificacionRecepcionObservaciones}` : ""
          }`}
        >
          <ClipboardCheck className="h-2.5 w-2.5" aria-hidden />
          Verificado — falta cargar en SECOP
        </span>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => marcarCargado(true)}
            disabled={cargando}
            className="rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Marcar cargado en SECOP
          </button>
        )}
        {error && <span className="text-[10px] text-red-700">{error}</span>}
      </span>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">Sin verificar recepción</span>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Verificar recepción
          </button>
        )}
      </span>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Verificación de recepción</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mb-2 text-xs text-stone-500">
              Confirma que el documento fue recibido y revisado antes de cargarlo en SECOP II. Queda registrado con su nombre y la fecha.
            </p>
            <label className="block text-xs font-medium text-stone-600">
              Observaciones (opcional)
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={verificar}
              disabled={cargando}
              className="mt-3 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
            >
              {cargando ? "Guardando…" : "Confirmar verificación"}
            </button>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
