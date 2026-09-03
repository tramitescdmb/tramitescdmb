import Link from "next/link";

/**
 * Paginador simple para listados server-rendered (searchParams?page=N). El caller arma el href de cada
 * página (para no perder los demás filtros de la URL) — este componente solo decide qué números mostrar
 * y si "Anterior"/"Siguiente" están habilitados.
 */
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
  // El resumen "Mostrando X–Y de Z" se muestra SIEMPRE, incluso cuando todo cabe en
  // una sola página — antes el componente entero desaparecía en ese caso (con un
  // filtro que reduce el resultado a menos de una página, quedaba sin ninguna pista
  // de cuántos había en total). Lo único que se oculta con una sola página son los
  // controles de Anterior/Siguiente, que ahí no tienen sentido.
  if (total === 0) return null;

  const desde = (paginaActual - 1) * porPagina + 1;
  const hasta = Math.min(paginaActual * porPagina, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm">
      <p className="text-stone-500">
        Mostrando <span className="font-medium text-stone-700">{desde}–{hasta}</span> de{" "}
        <span className="font-medium text-stone-700">{total}</span>
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          {paginaActual > 1 ? (
            <Link
              href={hrefPagina(paginaActual - 1)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-300">← Anterior</span>
          )}
          <span className="px-2 text-xs text-stone-400">
            Página {paginaActual} de {totalPaginas}
          </span>
          {paginaActual < totalPaginas ? (
            <Link
              href={hrefPagina(paginaActual + 1)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-300">Siguiente →</span>
          )}
        </div>
      )}
    </div>
  );
}
