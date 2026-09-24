"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Eye, X, XCircle } from "lucide-react";

export function ConfirmarFirmaModal({
  rol,
  endpointCompletar,
  endpointRechazar,
  documentoUrl,
  documentoNombre,
  documentoMimeType,
  contenidoTexto,
}: {
  rol: "FIRMA" | "VISTO_BUENO";
  endpointCompletar: string;
  endpointRechazar: string;
  documentoNombre: string;
  documentoUrl?: string;
  documentoMimeType?: string;
  contenidoTexto?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esImagen = documentoMimeType?.startsWith("image/") ?? false;
  const esPdf = documentoMimeType === "application/pdf";

  async function confirmar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpointCompletar, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo completar la solicitud.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
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
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={rol === "FIRMA" ? "Ver el documento y firmar" : "Ver el documento y dar visto bueno"}
        className="inline-flex items-center gap-1 rounded-md border border-cdmb-200 bg-cdmb-50 px-2 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-100"
      >
        <PenLine className="h-3 w-3" aria-hidden />
        {rol === "FIRMA" ? "Firmar" : "Dar visto bueno"}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${rol === "FIRMA" ? "Firmar" : "Dar visto bueno a"} ${documentoNombre}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-stone-800" title={documentoNombre}>
                <Eye className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
                {documentoNombre}
              </span>
              <button type="button" onClick={() => setAbierto(false)} title="Cerrar" className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-stone-500 hover:bg-stone-100">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-stone-100">
              {contenidoTexto !== undefined ? (
                <div className="whitespace-pre-wrap p-6 text-sm text-stone-800">{contenidoTexto || <span className="text-stone-400">(sin contenido)</span>}</div>
              ) : (
                <>
                  {esPdf && <iframe src={documentoUrl} title={documentoNombre} className="h-full min-h-[60vh] w-full" />}
                  {esImagen && (
                    <div className="flex h-full items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Supabase */}
                      <img src={documentoUrl} alt={documentoNombre} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {!esPdf && !esImagen && (
                    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 p-6 text-center">
                      <p className="text-sm text-stone-600">No hay vista previa disponible para este tipo de archivo ({documentoMimeType}).</p>
                      <p className="text-xs text-stone-400">Descárguelo para revisarlo antes de decidir.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-2.5">
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
        </div>
      )}
    </>
  );
}
