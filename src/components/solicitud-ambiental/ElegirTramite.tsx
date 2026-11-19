"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Search } from "lucide-react";
import { SelectorTramite } from "@/components/vital/SelectorTramite";
import type { TramiteOpcion } from "@/components/vital/tramite-opciones";
import { categoriaTramite, CATEGORIAS_ORDEN } from "@/lib/tramite-categoria";
import { CLASE_TARJETA_TRAMITE, CuerpoTarjetaTramite } from "@/components/TarjetaTramite";

type Tramite = TramiteOpcion & { descripcion: string; diasEstimados: number | null };

/**
 * Paso 1 de «Solicitud ambiental»: el mismo selector con buscador de «Convertir en trámite» de VITAL
 * y, debajo, los trámites agrupados por recurso natural para quien prefiere explorar.
 */
export function ElegirTramite({ tramites }: { tramites: Tramite[] }) {
  const [clave, setClave] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const elegido = tramites.find((t) => t.clave === clave && t.radicable) ?? null;

  const conCategoria = useMemo(() => tramites.map((t) => ({ t, cat: categoriaTramite(t.nombre, t.codigo, t.suits) })), [tramites]);
  const categorias = useMemo(
    () =>
      CATEGORIAS_ORDEN.map((c) => ({ c, lista: conCategoria.filter((x) => x.cat.id === c.id && x.t.radicable).map((x) => x.t) })).filter((g) => g.lista.length > 0),
    [conCategoria]
  );
  const catElegido = elegido ? categoriaTramite(elegido.nombre, elegido.codigo, elegido.suits) : null;
  const grupoAbierto = categorias.find((g) => g.c.id === categoriaId) ?? null;

  function elegir(t: Tramite) {
    setClave(t.clave);
    document.getElementById("tramite-elegido")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="space-y-6">
      <section id="elegir" aria-labelledby="titulo-elegir" className="scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-50 text-cdmb-700" aria-hidden>
            <Search className="h-4 w-4" />
          </span>
          <div>
            <h2 id="titulo-elegir" className="text-base font-semibold text-stone-900">
              ¿Qué trámite necesita?
            </h2>
            <p className="text-xs text-stone-500">Búsquelo por nombre o número SUIT, o explórelo por recurso natural más abajo.</p>
          </div>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-64">
            <span className="mb-1 block text-xs font-medium text-stone-600">Solicitud ambiental</span>
            <SelectorTramite
              tramites={tramites}
              clave={clave}
              claveSugerida={null}
              onChange={setClave}
              etiqueta="Solicitud ambiental"
              textoNoRadicable="se radica en VITAL"
              publico
            />
          </div>
          {elegido ? (
            <Link
              href={elegido.href}
              className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-acento-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-acento-300"
            >
              Iniciar solicitud
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-stone-200 px-4 py-2 text-sm font-medium text-stone-500">
              Iniciar solicitud
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>

        <div id="tramite-elegido" aria-live="polite">
          {elegido && catElegido && (
            <div className={`mt-5 overflow-hidden rounded-2xl border-l-4 bg-stone-50 ${catElegido.clases.borde}`}>
              <div className="flex gap-3 p-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${catElegido.clases.icono}`} aria-hidden>
                  <catElegido.Icono className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${catElegido.clases.badge}`}>
                    {catElegido.etiqueta}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {elegido.nombre}
                    {elegido.suits.length > 0 && <span className="text-xs font-normal text-stone-500"> · SUIT {elegido.suits.join(", ")}</span>}
                  </p>
                  {elegido.descripcion && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{elegido.descripcion}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="titulo-recursos" className="space-y-3">
        <h2 id="titulo-recursos" className="flex items-center gap-2 text-sm font-semibold text-stone-700">
          <Search className="h-4 w-4 text-cdmb-600" aria-hidden />
          Explore por recurso natural
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categorias.map(({ c, lista }) => {
            const abierto = categoriaId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-expanded={abierto}
                aria-controls="tramites-categoria"
                onClick={() => setCategoriaId(abierto ? null : c.id)}
                className={`group flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400 ${
                  abierto ? c.clases.borde : "border-stone-200"
                }`}
              >
                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${c.clases.icono}`} aria-hidden>
                  <c.Icono className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-stone-900">{c.etiqueta}</span>
                  <span className="text-xs text-stone-500">
                    {lista.length} {lista.length === 1 ? "trámite" : "trámites"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {grupoAbierto && (
          <ul id="tramites-categoria" className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
            {grupoAbierto.lista.map((t) => {
              const activo = t.clave === clave;
              return (
                <li key={t.clave}>
                  <button
                    type="button"
                    onClick={() => elegir(t)}
                    aria-pressed={activo}
                    className={`${CLASE_TARJETA_TRAMITE} w-full ${activo ? "ring-2 ring-cdmb-500" : ""}`}
                  >
                    <CuerpoTarjetaTramite
                      clases={grupoAbierto.c.clases}
                      etiqueta={grupoAbierto.c.etiqueta}
                      icono={<grupoAbierto.c.Icono className="h-6 w-6" />}
                      nombre={t.nombre}
                      suits={t.suits}
                      descripcion={t.descripcion}
                      diasEstimados={t.diasEstimados}
                    />
                    <span className="mt-3 flex items-center justify-end border-t border-stone-100 pt-3 text-sm font-semibold">
                      {activo ? (
                        <span className="inline-flex items-center gap-1 text-cdmb-700">
                          <Check className="h-4 w-4" aria-hidden /> Elegido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-acento-600 transition group-hover:gap-1.5">
                          Elegir este trámite <ArrowRight className="h-4 w-4" aria-hidden />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
