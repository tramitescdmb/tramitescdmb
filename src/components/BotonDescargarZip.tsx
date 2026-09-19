"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/** Botón de descarga de ZIP que muestra el mensaje de error del backend (ej. el tope de
 * expedientes de la descarga masiva) en vez de volcar el JSON de error como si fuera el archivo —
 * lo que pasaría con un `<a href>` simple cuando la respuesta no es un ZIP. */
export function BotonDescargarZip({ href, nombreArchivo, etiqueta, titulo }: { href: string; nombreArchivo: string; etiqueta: string; titulo?: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo generar el ZIP.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={descargar}
        disabled={cargando}
        title={titulo}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
      >
        {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
        {cargando ? "Generando ZIP…" : etiqueta}
      </button>
      {error && <p className="max-w-xs text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
