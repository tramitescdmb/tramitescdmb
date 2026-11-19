"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LayoutGrid, Search } from "lucide-react";
import { CLASE_TARJETA_TRAMITE, CuerpoTarjetaTramite } from "@/components/TarjetaTramite";
import type { Categoria } from "@/lib/tramite-categoria";

type Conteo = { activos: number; aprobados: number; negados: number };

type CategoriaParaCliente = {
  id: string;
  etiqueta: string;
  clases: Categoria["clases"];
  iconoGrande: ReactNode;
  iconoChico: ReactNode;
};

export type EntradaCatalogo = {
  key: string;
  href: string;
  codigo: string;
  version: string;
  nombre: string;
  suits: string[];
  descripcion: string;
  diasEstimados: number | null;
  conteo: Conteo | undefined;
};

/** Minúsculas y sin tildes: «arbol» encuentra «Árboles». */
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Cada palabra buscada debe aparecer en cualquier parte del nombre, el código o el número SUIT. */
function coincideBusqueda(entrada: EntradaCatalogo, termino: string) {
  const texto = normalizar(`${entrada.nombre} ${entrada.codigo} ${entrada.suits.join(" ")}`);
  return normalizar(termino)
    .split(/\s+/)
    .every((palabra) => texto.includes(palabra));
}

export function CatalogoTramites({
  secciones,
  busquedaInicial = "",
}: {
  secciones: { cat: CategoriaParaCliente; items: EntradaCatalogo[] }[];
  busquedaInicial?: string;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const totalTramites = secciones.reduce((acc, s) => acc + s.items.length, 0);

  const buscando = busqueda.trim().length > 0;
  // Al escribir se quita la categoría elegida: la búsqueda recorre todo el catálogo y un trámite
  // nunca «desaparece» por un filtro que quedó marcado. Elegir una categoría después la acota.
  const porCategoria = filtro ? secciones.filter((s) => s.cat.id === filtro) : secciones;
  const visibles = buscando
    ? porCategoria.map((s) => ({ ...s, items: s.items.filter((e) => coincideBusqueda(e, busqueda)) })).filter((s) => s.items.length > 0)
    : porCategoria;
  const totalVisible = visibles.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="space-y-6">
      <section aria-label="Buscar trámite" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-50 text-cdmb-700" aria-hidden>
            <Search className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-stone-900">¿Qué trámite busca?</h2>
            <p className="text-xs text-stone-500">Búsquelo por nombre, código o ficha SUIT, o explórelo por recurso natural.</p>
          </div>
        </div>
        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              if (e.target.value.trim()) setFiltro(null);
            }}
            placeholder="Buscar por nombre, código o ficha SUIT…"
            aria-label="Buscar trámite"
            className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-stone-800 placeholder:text-stone-400 transition-shadow focus:border-vivo-500 focus:outline-none focus:ring-4 focus:ring-vivo-500/15"
          />
        </div>
      </section>

      <nav aria-label="Filtrar por recurso natural" className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700">
          <Search className="h-4 w-4 text-cdmb-600" aria-hidden />
          Explore por recurso natural
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          <BotonCategoria
            activo={filtro === null}
            onClick={() => setFiltro(null)}
            clasesIcono="bg-graphite-800 text-white"
            borde="border-graphite-800"
            icono={<LayoutGrid className="h-5 w-5" />}
            etiqueta="Todas"
            cantidad={totalTramites}
          />
          {secciones.map(({ cat, items }) => (
            <BotonCategoria
              key={cat.id}
              activo={filtro === cat.id}
              onClick={() => setFiltro(filtro === cat.id ? null : cat.id)}
              clasesIcono={cat.clases.icono}
              borde={cat.clases.borde}
              icono={cat.iconoGrande}
              etiqueta={cat.etiqueta}
              cantidad={items.length}
            />
          ))}
        </div>
      </nav>

      {buscando && (
        <p className="text-sm text-stone-500">
          {totalVisible === 0 ? "Ningún trámite coincide con la búsqueda." : `${totalVisible} trámite${totalVisible === 1 ? "" : "s"} encontrado${totalVisible === 1 ? "" : "s"}.`}
        </p>
      )}

      {totalVisible === 0 && buscando ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500 shadow-soft">
          Ningún trámite coincide con &quot;{busqueda}&quot;.
        </div>
      ) : (
        <div className="space-y-8">
          {visibles.map(({ cat, items }) => (
            <div key={cat.id}>
              {filtro === cat.id && !buscando && (
                <div className="mb-4 flex items-center gap-3 border-b border-stone-200 pb-3">
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${cat.clases.icono}`} aria-hidden>
                    {cat.iconoGrande}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-stone-900">{cat.etiqueta}</h2>
                    <p className="text-xs text-stone-500">
                      {items.length} {items.length === 1 ? "trámite" : "trámites"} en esta categoría
                    </p>
                  </div>
                </div>
              )}
              {filtro === null && !buscando && (
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${cat.clases.pildora}`} aria-hidden />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{cat.etiqueta}</h2>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((entrada) => (
                  <TarjetaTramite key={entrada.key} entrada={entrada} categoria={cat} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaTramite({ entrada, categoria }: { entrada: EntradaCatalogo; categoria: CategoriaParaCliente }) {
  const { href, codigo, version, nombre, suits, descripcion, diasEstimados, conteo } = entrada;

  return (
    <Link prefetch={false} href={href} className={CLASE_TARJETA_TRAMITE}>
      <CuerpoTarjetaTramite
        clases={categoria.clases}
        etiqueta={categoria.etiqueta}
        icono={categoria.iconoGrande}
        nombre={nombre}
        suits={suits}
        descripcion={descripcion}
        diasEstimados={diasEstimados}
        codigo={`${codigo} · v${version}`}
      />

      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-stone-100 pt-2.5">
        {!conteo && <span className="text-xs text-stone-400">Sin expedientes todavía</span>}
        {conteo && conteo.activos > 0 && <CountPill color="amber" value={conteo.activos} label="activo" />}
        {conteo && conteo.aprobados > 0 && <CountPill color="emerald" value={conteo.aprobados} label="aprobado" />}
        {conteo && conteo.negados > 0 && <CountPill color="red" value={conteo.negados} label="negado" />}
      </div>
    </Link>
  );
}

function BotonCategoria({
  activo,
  onClick,
  clasesIcono,
  borde,
  icono,
  etiqueta,
  cantidad,
}: {
  activo: boolean;
  onClick: () => void;
  clasesIcono: string;
  borde: string;
  icono: ReactNode;
  etiqueta: string;
  cantidad: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400 ${
        activo ? `border-2 ${borde}` : "border border-stone-200"
      }`}
    >
      <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${clasesIcono}`} aria-hidden>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-stone-900">{etiqueta}</span>
        <span className="text-xs text-stone-500">
          {cantidad} {cantidad === 1 ? "trámite" : "trámites"}
        </span>
      </span>
    </button>
  );
}

function CountPill({ value, label, color }: { value: number; label: string; color: "amber" | "emerald" | "red" }) {
  const estilo = {
    amber: { chip: "bg-amber-50 text-amber-700 ring-amber-600/20", punto: "bg-amber-500" },
    emerald: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", punto: "bg-emerald-500" },
    red: { chip: "bg-red-50 text-red-700 ring-red-600/20", punto: "bg-red-500" },
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${estilo.chip}`}>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${estilo.punto}`} aria-hidden />
      {value} {label}
      {value === 1 ? "" : "s"}
    </span>
  );
}
