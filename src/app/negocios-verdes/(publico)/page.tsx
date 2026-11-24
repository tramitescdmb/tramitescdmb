import Link from "next/link";
import { Search } from "lucide-react";
import { filtrarNegociosNV, leerFiltroNV, paginar, type FiltroNV } from "@/lib/negocios-verdes";
import { configuracionPublicaNV, listarNegociosPublicos, opcionesFiltroNV } from "@/lib/negocios-verdes-data";
import { TarjetaNegocio } from "@/components/negocios-verdes/TarjetaNegocio";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function enlacePagina(filtro: FiltroNV, pagina: number) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtro)) if (v) q.set(k, v);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `/negocios-verdes${s ? `?${s}` : ""}#buscar`;
}

export default async function NegociosVerdesInicio({ searchParams }: Props) {
  const sp = await searchParams;
  const filtro = leerFiltroNV(sp);
  const [todos, nv] = await Promise.all([listarNegociosPublicos(), configuracionPublicaNV()]);
  const opciones = opcionesFiltroNV(todos);
  const resultado = paginar(filtrarNegociosNV(todos, filtro), Number(sp.pagina) || 1);
  const hayFiltro = Object.values(filtro).some(Boolean);
  const banner = nv.banners.find((b) => b.imagenUrl);
  const municipios = new Set(todos.map((n) => n.municipio)).size;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-emerald-800 text-white">
        {banner?.imagenUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.imagenUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        )}
        <div className="relative px-6 py-10 sm:px-10 sm:py-14">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-200">Programa Nacional de Negocios Verdes</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">Negocios verdes de la Meseta de Bucaramanga</h1>
          <p className="mt-3 max-w-2xl text-base text-emerald-50">
            Conozca y contacte los negocios que ofrecen bienes y servicios con impacto ambiental positivo en los municipios de la jurisdicción de la CDMB.
          </p>
          <dl className="mt-6 flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-emerald-200">Negocios publicados</dt>
              <dd className="text-2xl font-semibold">{todos.length}</dd>
            </div>
            <div>
              <dt className="text-emerald-200">Municipios</dt>
              <dd className="text-2xl font-semibold">{municipios}</dd>
            </div>
            <div>
              <dt className="text-emerald-200">Categorías</dt>
              <dd className="text-2xl font-semibold">{opciones.categorias.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="buscar" className="scroll-mt-4 space-y-4">
        <form method="get" action="/negocios-verdes#buscar" className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">¿Qué busca?</span>
            <input
              type="search"
              name="q"
              defaultValue={filtro.q ?? ""}
              placeholder="Café, ecoturismo, miel…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Municipio</span>
            <select name="municipio" defaultValue={filtro.municipio ?? ""} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Todos</option>
              {opciones.municipios.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.nombre} ({m.cantidad})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Categoría</span>
            <select name="categoria" defaultValue={filtro.categoria ?? ""} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Todas</option>
              {opciones.categorias.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre} ({c.cantidad})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Reconocimiento</span>
            <select name="reconocimiento" defaultValue={filtro.reconocimiento ?? ""} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Cualquiera</option>
              <option value="avalado">Avalado</option>
              <option value="sello">Sello de marca</option>
              <option value="emprendimiento">Emprendimiento verde</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              <Search className="h-4 w-4" aria-hidden /> Buscar
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
          <p>
            {resultado.total === 1 ? "1 negocio" : `${resultado.total} negocios`}
            {hayFiltro ? " con ese filtro" : ""}
          </p>
          {hayFiltro && (
            <Link prefetch={false} href="/negocios-verdes#buscar" className="font-medium text-emerald-700 hover:underline">
              Quitar filtros
            </Link>
          )}
        </div>

        {resultado.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
            {todos.length === 0 ? "Todavía no hay negocios publicados." : "No hay negocios que coincidan con la búsqueda. Pruebe con otras palabras o quite algún filtro."}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resultado.items.map((n) => (
              <li key={n.id} className="flex">
                <div className="flex w-full">
                  <TarjetaNegocio negocio={n} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {resultado.paginas > 1 && (
          <nav aria-label="Páginas" className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {resultado.pagina > 1 && (
              <Link prefetch={false} href={enlacePagina(filtro, resultado.pagina - 1)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                Anterior
              </Link>
            )}
            <span className="text-stone-600">
              Página {resultado.pagina} de {resultado.paginas}
            </span>
            {resultado.pagina < resultado.paginas && (
              <Link prefetch={false} href={enlacePagina(filtro, resultado.pagina + 1)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                Siguiente
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
