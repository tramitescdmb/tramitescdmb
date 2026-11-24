import Link from "next/link";
import { Award, BadgeCheck, Leaf, MapPin, Sprout } from "lucide-react";
import type { NegocioPublico } from "@/lib/negocios-verdes";

export function Reconocimientos({ negocio, grande = false }: { negocio: Pick<NegocioPublico, "avalado" | "selloMarca" | "emprendimientoVerde">; grande?: boolean }) {
  const clase = `inline-flex items-center gap-1 rounded-full font-medium ${grande ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`;
  return (
    <>
      {negocio.avalado && (
        <span className={`${clase} bg-emerald-100 text-emerald-800`} title="Negocio verde avalado por la CDMB">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Avalado
        </span>
      )}
      {negocio.selloMarca && (
        <span className={`${clase} bg-lime-100 text-lime-800`} title="Usa el sello de la marca Negocios Verdes">
          <Award className="h-3.5 w-3.5" aria-hidden /> Sello de marca
        </span>
      )}
      {negocio.emprendimientoVerde && (
        <span className={`${clase} bg-teal-100 text-teal-800`} title="Emprendimiento verde">
          <Sprout className="h-3.5 w-3.5" aria-hidden /> Emprendimiento verde
        </span>
      )}
    </>
  );
}

export function TarjetaNegocio({ negocio }: { negocio: NegocioPublico }) {
  return (
    <Link
      prefetch={false}
      href={`/negocios-verdes/negocio/${encodeURIComponent(negocio.slug)}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-[4/3] bg-emerald-50">
        {negocio.fotoPortadaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.fotoPortadaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-emerald-300">
            <Leaf className="h-12 w-12" aria-hidden />
          </div>
        )}
        {negocio.destacado && <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">Destacado</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-emerald-700">
          {negocio.categoria.icono ? `${negocio.categoria.icono} ` : ""}
          {negocio.categoria.nombre}
        </p>
        <h3 className="text-base font-semibold leading-snug text-stone-900 group-hover:text-emerald-800">{negocio.nombre}</h3>
        {negocio.descripcionCorta && <p className="line-clamp-3 text-sm text-stone-600">{negocio.descripcionCorta}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {negocio.municipio}
            {negocio.vereda ? ` · ${negocio.vereda}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Reconocimientos negocio={negocio} />
        </div>
      </div>
    </Link>
  );
}
