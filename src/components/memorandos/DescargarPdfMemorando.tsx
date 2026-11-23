"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { memorandoAPdf } from "@/lib/memorando-pdf";
import type { DatosDocumentoMemorando } from "@/components/memorandos/DocumentoMemorando";

/**
 * Genera el PDF del memorando en el navegador con texto vectorial (nítido, seleccionable y liviano), a
 * partir de los mismos datos del documento en pantalla, y lo descarga.
 */
export function DescargarPdfMemorando({ datos, nombreArchivo }: { datos: DatosDocumentoMemorando; nombreArchivo: string }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    try {
      const bytes = await memorandoAPdf(datos, nombreArchivo);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombreArchivo.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={descargar}
        disabled={generando}
        className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
      >
        {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        Descargar PDF
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
