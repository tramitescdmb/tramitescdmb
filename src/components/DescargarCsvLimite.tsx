const OPCIONES = ["50", "100", "150", "200", "todos"] as const;

/**
 * "Descargar CSV" con varios tamaños fijos + "Todos" — para listados que
 * pueden crecer mucho (VITAL, SINCA 1.0) y no siempre se quiere el archivo
 * completo. Cada opción es un link normal (no fetch/JS): el navegador
 * dispara la descarga directo desde la ruta de API.
 */
export function DescargarCsvLimite({ href }: { href: (limite: (typeof OPCIONES)[number]) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-stone-400">⬇ Descargar CSV:</span>
      {OPCIONES.map((o) => (
        <a
          key={o}
          href={href(o)}
          className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:border-cdmb-300 hover:bg-cdmb-50 hover:text-cdmb-700"
        >
          {o === "todos" ? "Todos" : o}
        </a>
      ))}
    </div>
  );
}
