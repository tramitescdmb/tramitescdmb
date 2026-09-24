"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, XCircle } from "lucide-react";

export function FirmarSolicitudInline({
  rol,
  endpointCompletar,
  endpointRechazar,
  documentoUrl,
  documentoNombre,
  documentoMimeType,
  volverHref,
}: {
  rol: "FIRMA" | "VISTO_BUENO";
  endpointCompletar: string;
  endpointRechazar: string;
  documentoUrl: string;
  documentoNombre: string;
  documentoMimeType: string;
  volverHref: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esImagen = documentoMimeType.startsWith("image/");
  const esPdf = documentoMimeType === "application/pdf";

  async function confirmar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpointCompletar, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo completar la solicitud.");
      router.push(volverHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setCargando(false);
    }
  }

  async function rechazar() {
    const comentario = window.prompt("Motivo del rechazo:");
    if (comentario === null) return;
    if (!comentario.trim()) return setError("Debe indicar un motivo.");
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpointRechazar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo rechazar.");
      router.push(volverHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="max-h-[70vh] overflow-auto bg-stone-100">
        {esPdf && <iframe src={documentoUrl} title={documentoNombre} className="h-[70vh] w-full" />}
        {esImagen && (
          <div className="flex h-[70vh] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Supabase */}
            <img src={documentoUrl} alt={documentoNombre} className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {!esPdf && !esImagen && (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-stone-600">No hay vista previa disponible para este tipo de archivo ({documentoMimeType}).</p>
            <p className="text-xs text-stone-400">Descárguelo para revisarlo antes de decidir.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
        {error ? <p className="text-xs text-red-700">{error}</p> : <span />}
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={rechazar}
            disabled={cargando}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Rechazar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={cargando}
            className="inline-flex items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {cargando ? "Guardando…" : rol === "FIRMA" ? "Confirmar firma" : "Confirmar visto bueno"}
          </button>
        </div>
      </div>
    </div>
  );
}
