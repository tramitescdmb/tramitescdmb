import Link from "next/link";

export function Paginador({
  paginaActual,
  totalPaginas,
  total,
  porPagina,
  hrefPagina,
}: {
  paginaActual: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  hrefPagina: (pagina: number) => string;
}) {
  if (total === 0) return null;

  const desde = (paginaActual - 1) * porPagina + 1;
  const hasta = Math.min(paginaActual * porPagina, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite-100 px-4 py-3 text-sm">
      <p className="text-graphite-500">
        Mostrando <span className="font-medium text-graphite-700">{desde}–{hasta}</span> de{" "}
        <span className="font-medium text-graphite-700">{total}</span>
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          {paginaActual > 1 ? (
            <Link
              href={hrefPagina(paginaActual - 1)}
              className="rounded-lg border border-graphite-200 px-3 py-1.5 text-graphite-700 transition-colors hover:bg-graphite-50"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="rounded-lg border border-graphite-100 px-3 py-1.5 text-graphite-300">← Anterior</span>
          )}
          <span className="px-2 text-xs text-graphite-400">
            Página {paginaActual} de {totalPaginas}
          </span>
          {paginaActual < totalPaginas ? (
            <Link
              href={hrefPagina(paginaActual + 1)}
              className="rounded-lg border border-graphite-200 px-3 py-1.5 text-graphite-700 transition-colors hover:bg-graphite-50"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="rounded-lg border border-graphite-100 px-3 py-1.5 text-graphite-300">Siguiente →</span>
          )}
        </div>
      )}
    </div>
  );
}
