import Link from "next/link";
import { Award, BadgeCheck, Check, Leaf, MapPin } from "lucide-react";
import type { NegocioPublico } from "@/lib/negocios-verdes";
import { LOGO_PROGRAMA_NV } from "@/lib/negocios-verdes-sitio";

/** Chip de filtro (verde claro; elegido en verde de menú con chulito), como en la plataforma anterior. */
export function claseChipNV(elegido: boolean) {
  return `inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] px-4 py-1 text-[13.5px] tracking-[0.01em] text-nv-texto transition-colors ${
    elegido ? "bg-nv-menu font-semibold" : "bg-nv-claro hover:bg-[#cfe6da]"
  }`;
}

export function ChipNV({ href, elegido, children }: { href: string; elegido: boolean; children: React.ReactNode }) {
  return (
    <Link prefetch={false} href={href} scroll={false} aria-current={elegido ? "true" : undefined} className={claseChipNV(elegido)}>
      {elegido && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </Link>
  );
}

type ConSellos = Pick<NegocioPublico, "avalado" | "selloMarca" | "emprendimientoVerde">;

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold";

export function InsigniaEmprendimiento({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`${base} border border-nv-gris/40 bg-nv-gris/10 text-nv-gris ${grande ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}>
      <Leaf className={grande ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden /> Emprendimiento Verde
    </span>
  );
}

export function InsigniaSello({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`${base} bg-gradient-to-r from-nv-vivo to-[#6fd88a] text-white shadow-[0_0_6px_rgba(1,189,50,0.35)] ${grande ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}>
      <Award className={grande ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden /> Sello Marca
    </span>
  );
}

export function InsigniaAvalado({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`${base} border border-nv-azul/40 bg-nv-azul/10 text-nv-azul ${grande ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}>
      <BadgeCheck className={grande ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden /> Negocio Verde Avalado
    </span>
  );
}

/** Los tres reconocimientos, cada uno enlazado al buscador filtrado por él. */
export function Reconocimientos({ negocio, grande = false }: { negocio: ConSellos; grande?: boolean }) {
  return (
    <>
      {negocio.emprendimientoVerde && (
        <Link prefetch={false} href="/negocios-verdes/buscar?reconocimiento=emprendimiento" title="Emprendimiento Verde">
          <InsigniaEmprendimiento grande={grande} />
        </Link>
      )}
      {negocio.selloMarca && (
        <Link prefetch={false} href="/negocios-verdes/buscar?reconocimiento=sello" title="Sello Marca">
          <InsigniaSello grande={grande} />
        </Link>
      )}
      {negocio.avalado && (
        <Link prefetch={false} href="/negocios-verdes/buscar?reconocimiento=avalado" title="Negocio Verde Avalado">
          <InsigniaAvalado grande={grande} />
        </Link>
      )}
    </>
  );
}

const etiqueta = "inline-flex max-w-full items-center gap-1 truncate rounded-[8px] bg-nv-claro px-2 py-[3px] text-[10px] font-semibold text-nv-oscuro hover:bg-[#cfe6da]";

/**
 * Tarjeta horizontal del buscador (foto o logo del programa a la izquierda, datos a la derecha), igual
 * a la plataforma anterior. Los rótulos (categoría, municipio, subcategorías, reconocimientos) llevan
 * al buscador filtrado.
 */
export function TarjetaNegocio({ negocio }: { negocio: NegocioPublico }) {
  const ficha = `/negocios-verdes/negocio/${encodeURIComponent(negocio.slug)}`;
  const tieneUbicacion = negocio.latitud !== null && negocio.longitud !== null;
  const categoria = negocio.categorias[0];
  return (
    <article className="relative flex w-full overflow-hidden rounded-[12px] border border-nv-borde bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-md">
      <Link prefetch={false} href={ficha} tabIndex={-1} aria-hidden className="flex h-32 w-32 flex-none items-center justify-center bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={negocio.fotoPortadaUrl ?? LOGO_PROGRAMA_NV} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      </Link>
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start gap-1">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold">
            <Link prefetch={false} href={ficha} className="after:absolute after:inset-0 hover:text-nv-oscuro">
              {negocio.nombre}
            </Link>
          </h3>
          {tieneUbicacion && (
            <Link prefetch={false} href={`/negocios-verdes/geovisor?negocio=${encodeURIComponent(negocio.slug)}`} title="Ver en el mapa" aria-label={`Ver ${negocio.nombre} en el mapa`} className="relative z-10 text-nv-vivo">
              <MapPin className="h-5 w-5" aria-hidden />
            </Link>
          )}
        </div>
        {categoria && (
          <Link prefetch={false} href={`/negocios-verdes/buscar?categoria=${encodeURIComponent(categoria.slug)}`} className="relative z-10 mt-0.5 block truncate text-xs text-nv-texto2 hover:underline">
            {categoria.icono ? `${categoria.icono} ` : ""}
            {categoria.nombre}
          </Link>
        )}
        {negocio.descripcionCorta && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug">{negocio.descripcionCorta}</p>}
        <div className="relative z-10 mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1">
          <Reconocimientos negocio={negocio} />
          <Link prefetch={false} href={`/negocios-verdes/buscar?municipio=${encodeURIComponent(negocio.municipio)}`} className={etiqueta}>
            <MapPin className="h-2.5 w-2.5" aria-hidden />
            {negocio.municipio}
          </Link>
          {negocio.subcategorias.slice(0, 2).map((s) => (
            <Link key={s.id} prefetch={false} href={`/negocios-verdes/buscar?subcategoria=${encodeURIComponent(s.slug)}`} className={etiqueta}>
              {s.nombre}
            </Link>
          ))}
          {!tieneUbicacion && <span className="rounded-[8px] bg-nv-borde px-2 py-[3px] text-[10px] text-nv-texto2">Sin ubicación en el mapa</span>}
        </div>
      </div>
    </article>
  );
}
