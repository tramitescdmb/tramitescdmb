import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { MUNICIPIOS_NV, filtrarNegociosNV, leerFiltroNV, paginar, type FiltroNV } from "@/lib/negocios-verdes";
import { listarNegociosPublicos, taxonomiaPublicaNV } from "@/lib/negocios-verdes-data";
import { aPuntoMapa, type PuntoMapaNV } from "@/lib/negocios-verdes-mapa";
import { ChipNV, TarjetaNegocio } from "@/components/negocios-verdes/TarjetaNegocio";
import { MapaResultadosNV } from "@/components/negocios-verdes/sitio/MapaResultadosNV";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buscar" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Dirección del buscador con el filtro actual cambiado (cambiar un nivel limpia los de abajo). */
function enlace(filtro: FiltroNV, cambio: Partial<FiltroNV>, pagina = 1) {
  const f: FiltroNV = { ...filtro, ...cambio };
  if ("categoria" in cambio) {
    f.subcategoria = undefined;
    f.actividad = undefined;
  }
  if ("subcategoria" in cambio) f.actividad = undefined;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `/negocios-verdes/buscar${s ? `?${s}` : ""}`;
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-nv-oscuro">{children}</p>;
}

/** Buscador público: barra de filtros en fichas, resultados en tarjetas y, debajo, el mapa de los resultados. */
export default async function BuscarNV({ searchParams }: Props) {
  const sp = await searchParams;
  const filtro = leerFiltroNV(sp);
  const [todos, categorias] = await Promise.all([listarNegociosPublicos(), taxonomiaPublicaNV()]);
  const resultado = filtrarNegociosNV(todos, filtro);
  const pag = paginar(resultado, Number(sp.pagina) || 1);
  const cat = categorias.find((c) => c.slug === filtro.categoria);
  const sub = cat?.subcategorias.find((s) => s.slug === filtro.subcategoria);
  const puntos = resultado.map(aPuntoMapa).filter((p): p is PuntoMapaNV => p !== null);

  return (
    <div className="pb-6">
      <div className="px-5 pt-4">
        <div className="rounded-[16px] bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <form action="/negocios-verdes/buscar" method="get" role="search" className="flex items-center rounded-[28px] bg-nv-fondo pl-4">
            {Object.entries(filtro).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <Search className="h-6 w-6 flex-none text-nv-vivo" aria-hidden />
            <input
              name="q"
              defaultValue={filtro.q ?? ""}
              placeholder="Buscar negocios verdes (ej. ganadería sostenible, turismo de naturaleza...)"
              aria-label="Buscar negocios verdes"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-nv-texto2"
            />
          </form>

          <Rotulo>Municipio</Rotulo>
          <div className="flex flex-wrap gap-2">
            <ChipNV href={enlace(filtro, { municipio: undefined })} elegido={!filtro.municipio}>
              Todos los municipios
            </ChipNV>
            {MUNICIPIOS_NV.map((m) => (
              <ChipNV key={m} href={enlace(filtro, { municipio: m })} elegido={filtro.municipio === m}>
                {m}
              </ChipNV>
            ))}
          </div>

          <Rotulo>Categoría</Rotulo>
          <div className="flex flex-wrap gap-2">
            <ChipNV href={enlace(filtro, { categoria: undefined })} elegido={!filtro.categoria}>
              Todas las categorías
            </ChipNV>
            {categorias.map((c) => (
              <ChipNV key={c.id} href={enlace(filtro, { categoria: c.slug })} elegido={filtro.categoria === c.slug}>
                {c.icono ? `${c.icono} ` : ""}
                {c.nombre}
              </ChipNV>
            ))}
          </div>

          {cat && cat.subcategorias.length > 0 && (
            <>
              <Rotulo>Subcategoría — dentro de la categoría elegida</Rotulo>
              <div className="flex flex-wrap gap-2">
                <ChipNV href={enlace(filtro, { subcategoria: undefined })} elegido={!filtro.subcategoria}>
                  Todas
                </ChipNV>
                {cat.subcategorias.map((s) => (
                  <ChipNV key={s.id} href={enlace(filtro, { subcategoria: s.slug })} elegido={filtro.subcategoria === s.slug}>
                    {s.icono ? `${s.icono} ` : ""}
                    {s.nombre}
                  </ChipNV>
                ))}
              </div>
            </>
          )}

          {sub && sub.actividades.length > 0 && (
            <>
              <Rotulo>Actividad productiva — dentro de la subcategoría elegida</Rotulo>
              <div className="flex flex-wrap gap-2">
                <ChipNV href={enlace(filtro, { actividad: undefined })} elegido={!filtro.actividad}>
                  Todas
                </ChipNV>
                {sub.actividades.map((a) => (
                  <ChipNV key={a.id} href={enlace(filtro, { actividad: a.slug })} elegido={filtro.actividad === a.slug}>
                    {a.icono ? `${a.icono} ` : ""}
                    {a.nombre}
                  </ChipNV>
                ))}
              </div>
            </>
          )}

          <Rotulo>Reconocimiento</Rotulo>
          <div className="flex flex-wrap gap-2">
            <ChipNV href={enlace(filtro, { reconocimiento: undefined })} elegido={!filtro.reconocimiento}>
              Todos los reconocimientos
            </ChipNV>
            <ChipNV href={enlace(filtro, { reconocimiento: "emprendimiento" })} elegido={filtro.reconocimiento === "emprendimiento"}>
              🌱 Emprendimiento Verde
            </ChipNV>
            <ChipNV href={enlace(filtro, { reconocimiento: "avalado" })} elegido={filtro.reconocimiento === "avalado"}>
              ✅ Negocio Verde Avalado
            </ChipNV>
            <ChipNV href={enlace(filtro, { reconocimiento: "sello" })} elegido={filtro.reconocimiento === "sello"}>
              🎖️ Sello Marca
            </ChipNV>
          </div>
        </div>
      </div>

      <p id="resultados" className="scroll-mt-28 px-5 pb-2.5 pt-3.5 text-xs text-nv-texto2">
        {pag.total} {pag.total === 1 ? "negocio encontrado" : "negocios encontrados"}
        {pag.paginas > 1 ? ` · página ${pag.pagina} de ${pag.paginas}` : ""}
      </p>

      {pag.items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-lg font-semibold">No encontramos negocios con estos filtros</p>
          <p className="mt-1 text-sm text-nv-texto2">Prueba con otra búsqueda o quita algún filtro.</p>
        </div>
      ) : (
        <ul className="grid gap-3 px-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pag.items.map((n) => (
            <li key={n.id} className="flex">
              <TarjetaNegocio negocio={n} />
            </li>
          ))}
        </ul>
      )}

      {pag.paginas > 1 && (
        <nav aria-label="Páginas" className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-sm">
          {pag.pagina > 1 ? (
            <Link prefetch={false} href={`${enlace(filtro, {}, pag.pagina - 1)}#resultados`} className="inline-flex items-center gap-1 rounded-[8px] border border-nv-vivo px-4 py-1.5 font-semibold text-nv-vivo hover:bg-nv-claro">
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden /> Anterior
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-[8px] border border-nv-borde px-4 py-1.5 text-nv-texto2/60">
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden /> Anterior
            </span>
          )}
          <span className="font-semibold">
            Página {pag.pagina} de {pag.paginas}
          </span>
          {pag.pagina < pag.paginas ? (
            <Link prefetch={false} href={`${enlace(filtro, {}, pag.pagina + 1)}#resultados`} className="inline-flex items-center gap-1 rounded-[8px] border border-nv-vivo px-4 py-1.5 font-semibold text-nv-vivo hover:bg-nv-claro">
              Siguiente <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-[8px] border border-nv-borde px-4 py-1.5 text-nv-texto2/60">
              Siguiente <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
            </span>
          )}
        </nav>
      )}

      {puntos.length > 0 && (
        <section className="mt-6 px-3">
          <h2 className="mb-2 px-2 text-base font-bold text-nv-oscuro">Ubicación de los {puntos.length} negocios con dirección</h2>
          <MapaResultadosNV puntos={puntos} />
        </section>
      )}
    </div>
  );
}
