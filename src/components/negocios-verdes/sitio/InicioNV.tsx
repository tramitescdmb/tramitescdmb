"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Pause, Play, Search } from "lucide-react";
import { MUNICIPIOS_NV } from "@/lib/negocios-verdes";
import type { CategoriaPublicaNV } from "@/lib/negocios-verdes-data";
import { claseChipNV } from "@/components/negocios-verdes/TarjetaNegocio";

export type DiapositivaNV =
  | { tipo: "imagen"; imagenUrl: string; destino: string | null; nuevaPestana: boolean }
  | { tipo: "texto"; titulo: string; subtitulo: string; fondo: string; oscuro: boolean; boton?: string; destino?: string };

/**
 * Imagen de un banner. Si no ocupa todo el recuadro (banners de distinta proporción), el espacio
 * sobrante se llena con la misma imagen desenfocada en lugar de una franja de color.
 */
function ImagenBanner({ url, natural }: { url: string; natural: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className={`relative ${natural ? "block h-auto w-full" : "h-full w-full object-contain"}`} />
    </div>
  );
}

/** Carrusel del inicio: banners cargados en «Apariencia» o, si no hay, las 4 diapositivas genéricas. */
export function CarruselNV({ diapositivas }: { diapositivas: DiapositivaNV[] }) {
  const [i, setI] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(true);
  const n = diapositivas.length;
  useEffect(() => {
    if (!reproduciendo || n <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [reproduciendo, n, i]);
  if (n === 0) return null;
  const ir = (x: number) => setI(((x % n) + n) % n);
  // Con solo banners de imagen, el carrusel toma la proporción de la imagen a todo el ancho: sin franjas ni recortes.
  const soloImagenes = diapositivas.every((d) => d.tipo === "imagen");
  const boton = "rounded-full bg-black/25 p-1.5 text-white hover:bg-black/40";

  return (
    <section aria-roledescription="carrusel" aria-label="Destacados" className={`relative w-full overflow-hidden ${soloImagenes ? "bg-nv-fondo" : "h-[min(300px,25vw)] min-h-[180px] bg-nv-menu"}`}>
      <div className="flex h-full transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {diapositivas.map((d, k) => (
          <div key={k} className="h-full w-full flex-none" aria-hidden={k !== i}>
            {d.tipo === "imagen" ? (
              d.destino ? (
                <a href={d.destino} target={d.nuevaPestana ? "_blank" : undefined} rel={d.nuevaPestana ? "noopener noreferrer" : undefined} tabIndex={k === i ? 0 : -1} className="block h-full">
                  <ImagenBanner url={d.imagenUrl} natural={soloImagenes} />
                </a>
              ) : (
                <ImagenBanner url={d.imagenUrl} natural={soloImagenes} />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ background: d.fondo, color: d.oscuro ? "#1b2a20" : "#fff" }}>
                <h2 className="text-2xl font-bold sm:text-[28px]">{d.titulo}</h2>
                <p className="mt-2 max-w-[560px] text-[15px] opacity-85">{d.subtitulo}</p>
                {d.boton && d.destino && (
                  <a href={d.destino} tabIndex={k === i ? 0 : -1} className="mt-4 rounded-[8px] border px-4 py-1.5 text-sm font-semibold" style={{ borderColor: "currentColor" }}>
                    {d.boton}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" onClick={() => { ir(i - 1); }} aria-label="Anterior" className={`${boton} absolute left-3 top-1/2 -translate-y-1/2`}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => { ir(i + 1); }} aria-label="Siguiente" className={`${boton} absolute right-3 top-1/2 -translate-y-1/2`}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-2 py-1">
            <button type="button" onClick={() => setReproduciendo((v) => !v)} aria-label={reproduciendo ? "Pausar" : "Reproducir"} className="text-white">
              {reproduciendo ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            </button>
            {diapositivas.map((_, k) => (
              <button key={k} type="button" onClick={() => ir(k)} aria-label={`Diapositiva ${k + 1}`} className={`h-[7px] rounded-[4px] bg-white transition-all ${k === i ? "w-[22px] opacity-95" : "w-[7px] opacity-50"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Buscador redondo del inicio (con el colibrí como botón) y sugerencias de nombres. */
export function BuscadorInicioNV({ sugerencias }: { sugerencias: string[] }) {
  return (
    <div className="bg-nv-fondo px-5 pb-4 pt-7">
      <form action="/negocios-verdes/buscar" method="get" role="search" className="mx-auto flex max-w-[580px] items-center rounded-[32px] border border-nv-vivo/15 bg-white pl-4 shadow-[0_6px_14px_rgba(1,189,50,0.18)] focus-within:border-nv-vivo">
        <Search className="h-6 w-6 flex-none text-nv-vivo" aria-hidden />
        <input name="q" list="nv-sugerencias" placeholder="Busca por Negocio Verde" aria-label="Busca por Negocio Verde" className="min-w-0 flex-1 bg-transparent px-3 py-[18px] text-[15px] outline-none placeholder:text-sm placeholder:text-nv-texto2" />
        <datalist id="nv-sugerencias">
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button type="submit" aria-label="Buscar" className="m-1.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-nv-menu hover:brightness-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/negocios-verdes/iconografia/colibri_1.png" alt="" className="h-[22px] w-[22px]" />
        </button>
      </form>
    </div>
  );
}

const PALETA = ["#DCEEE6", "#FBE7D3", "#DCEAF7", "#F3E1E8", "#EFEAD6", "#DCF0EC", "#E9E0F5", "#E9F0DA"];

function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[22px] font-semibold">{titulo}</h2>
      {subtitulo && <p className="text-[13px] text-nv-texto2">{subtitulo}</p>}
    </div>
  );
}

function Chip({ elegido, onClick, children, ancho }: { elegido: boolean; onClick: () => void; children: React.ReactNode; ancho?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={elegido} className={`${claseChipNV(elegido)} min-h-[40px] ${ancho ? "min-w-[180px]" : ""}`}>
      {elegido && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Filtros acumulables del inicio: se marca municipio, categoría, subcategoría y actividad (cada nivel
 * aparece al elegir el anterior) y el botón naranja lleva al buscador con lo marcado.
 */
export function FiltrosInicioNV({ categorias }: { categorias: CategoriaPublicaNV[] }) {
  const router = useRouter();
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [subcategoria, setSubcategoria] = useState<string | null>(null);
  const [actividad, setActividad] = useState<string | null>(null);
  const cat = categorias.find((c) => c.slug === categoria);
  const sub = cat?.subcategorias.find((s) => s.slug === subcategoria);
  const act = sub?.actividades.find((a) => a.slug === actividad);
  const resumen = [municipio, cat?.nombre, sub?.nombre, act?.nombre].filter(Boolean).join(" · ");

  const buscar = () => {
    const q = new URLSearchParams();
    if (municipio) q.set("municipio", municipio);
    if (categoria) q.set("categoria", categoria);
    if (subcategoria) q.set("subcategoria", subcategoria);
    if (actividad) q.set("actividad", actividad);
    const s = q.toString();
    router.push(`/negocios-verdes/buscar${s ? `?${s}` : ""}`);
  };

  return (
    <>
      <section className="px-5 pb-2 pt-8">
        <Encabezado titulo="Municipios" />
        <div className="flex flex-wrap gap-2">
          {MUNICIPIOS_NV.map((m) => (
            <Chip key={m} elegido={municipio === m} onClick={() => setMunicipio(municipio === m ? null : m)}>
              📍 {m}
            </Chip>
          ))}
        </div>
      </section>
      {categorias.length > 0 && (
        <section className="px-5 pb-2 pt-8">
          <Encabezado titulo="Categorías" />
          <div className="flex flex-wrap gap-3">
            {categorias.map((c, k) => {
              const elegida = categoria === c.slug;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => {
                    setCategoria(elegida ? null : c.slug);
                    setSubcategoria(null);
                    setActividad(null);
                  }}
                  className={`flex h-[132px] w-[136px] flex-col items-start rounded-[16px] border-2 bg-white p-3.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.10)] transition hover:-translate-y-0.5 ${elegida ? "border-nv-vivo" : "border-transparent"}`}
                >
                  <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[19px]" style={{ background: PALETA[k % PALETA.length] }} aria-hidden>
                    {c.iconoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.iconoUrl} alt="" className="h-5 w-5 object-contain" />
                    ) : (
                      c.icono
                    )}
                  </span>
                  <span className="mt-2.5 line-clamp-3 text-[11px] font-semibold leading-[1.2]">{c.nombre}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {cat && cat.subcategorias.length > 0 && (
        <section className="px-5 pb-2 pt-8">
          <Encabezado titulo="Subcategorías" subtitulo={`Dentro de ${cat.nombre}`} />
          <div className="flex flex-wrap gap-2">
            {cat.subcategorias.map((s) => (
              <Chip key={s.id} ancho elegido={subcategoria === s.slug} onClick={() => { setSubcategoria(subcategoria === s.slug ? null : s.slug); setActividad(null); }}>
                {s.icono ? `${s.icono} ` : ""}
                {s.nombre}
              </Chip>
            ))}
          </div>
        </section>
      )}
      {sub && sub.actividades.length > 0 && (
        <section className="px-5 pb-2 pt-8">
          <Encabezado titulo="Actividades productivas" subtitulo={`Dentro de ${sub.nombre}`} />
          <div className="flex flex-wrap gap-2">
            {sub.actividades.map((a) => (
              <Chip key={a.id} ancho elegido={actividad === a.slug} onClick={() => setActividad(actividad === a.slug ? null : a.slug)}>
                {a.icono ? `${a.icono} ` : ""}
                {a.nombre}
              </Chip>
            ))}
          </div>
        </section>
      )}
      <div className="mx-auto max-w-[420px] px-5 pb-2 pt-6">
        {resumen && <p className="mb-2.5 text-center text-[12.5px] text-nv-texto2">Buscando: {resumen}</p>}
        <button type="button" onClick={buscar} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-nv-acento px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nv-acento-oscuro">
          <Search className="h-5 w-5" aria-hidden /> Buscar negocios verdes
        </button>
      </div>
    </>
  );
}
