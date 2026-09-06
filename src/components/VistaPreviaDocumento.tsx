"use client";

import { useEffect, useState } from "react";
import { Eye, X, Download } from "lucide-react";

/**
 * Antes "Abrir" solo navegaba/descargaba (MoReq 4.15: previsualizar sin descargar).
 * Reutiliza la MISMA ruta de descarga como fuente del iframe/imagen — ya sirve el
 * archivo con el Content-Type original (no fuerza descarga), así que basta con
 * pedirlo dentro de un visor en vez de navegar la pestaña completa a esa URL.
 */
export function VistaPreviaDocumento({ url, nombre, mimeType }: { url: string; nombre: string; mimeType: string }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  const esImagen = mimeType.startsWith("image/");
  const esPdf = mimeType === "application/pdf";
  const previsualizable = esImagen || esPdf;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Ver el documento sin descargarlo"
        className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        Vista previa
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${nombre}`}
          onClick={() => setAbierto(false)}
        >
          <div
            className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-stone-800" title={nombre}>{nombre}</span>
              <div className="flex flex-none items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  title="Cerrar"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-stone-100">
              {esPdf && <iframe src={url} title={nombre} className="h-full min-h-[70vh] w-full" />}
              {esImagen && (
                <div className="flex h-full items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- viene de una URL firmada externa (Supabase), no de /public */}
                  <img src={url} alt={nombre} className="max-h-full max-w-full object-contain" />
                </div>
              )}
              {!previsualizable && (
                <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm text-stone-600">
                    No hay vista previa disponible para este tipo de archivo ({mimeType}).
                  </p>
                  <p className="text-xs text-stone-400">Descárguelo para abrirlo con la aplicación correspondiente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
