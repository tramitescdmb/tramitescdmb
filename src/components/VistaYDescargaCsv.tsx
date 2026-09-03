import { OPCIONES_VISTA, type OpcionVista } from "@/lib/vista-lista";

/**
 * Selector "Ver: 50 · 100 · 150 · 200 · Todos" (cuántos registros mostrar en
 * pantalla) + un único "Descargar CSV" que exporta esa misma cantidad — antes
 * eran botones de descarga sueltos, sin relación con lo que se estaba viendo.
 */
export function VistaYDescargaCsv({
  vistaActual,
  hrefVista,
  hrefDescarga,
}: {
  vistaActual: OpcionVista;
  hrefVista: (vista: OpcionVista) => string;
  hrefDescarga: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-400">Ver:</span>
        {OPCIONES_VISTA.map((v) => (
          <a
            key={v}
            href={hrefVista(v)}
            aria-current={v === vistaActual ? "true" : undefined}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              v === vistaActual
                ? "border-cdmb-600 bg-cdmb-600 text-white"
                : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {v === "todos" ? "Todos" : v}
          </a>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de archivo (ruta de API), no una página */}
      <a
        href={hrefDescarga}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-cdmb-300 hover:bg-cdmb-50 hover:text-cdmb-700"
      >
        ⬇ Descargar CSV ({vistaActual === "todos" ? "todos" : vistaActual})
      </a>
    </div>
  );
}
