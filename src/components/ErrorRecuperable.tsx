"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

const CLAVE_RECARGA = "recarga-por-version";

function esErrorDeVersion(error: Error): boolean {
  const texto = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch/i.test(texto);
}

export function ErrorRecuperable({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  const deVersion = esErrorDeVersion(error);

  useEffect(() => {
    if (!deVersion) return;
    try {
      const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
      if (Date.now() - ultima > 30_000) {
        sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [deVersion]);

  return (
    <div className="mx-auto my-16 max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-soft">
      <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
      <h1 className="mt-3 text-base font-semibold text-stone-900">
        {deVersion ? "La plataforma se actualizó" : "No se pudo mostrar esta página"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        {deVersion ? "Recargue para usar la versión más reciente." : "Intente de nuevo. Si el problema continúa, informe al administrador del sistema."}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Recargar
        </button>
        {!deVersion && reset && (
          <button type="button" onClick={reset} className="rounded-md border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Reintentar
          </button>
        )}
      </div>
      {error.digest && <p className="mt-3 font-mono text-[10px] text-stone-300">Ref. {error.digest}</p>}
    </div>
  );
}
