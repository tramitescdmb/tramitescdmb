import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Contact, Globe, Info, Mail, Map as MapaIcono, MapPin, MessageSquare, Navigation, Phone, ShoppingBag, Star, type LucideIcon } from "lucide-react";
import { IconBrandFacebook, IconBrandInstagram, IconBrandWhatsapp, IconId, type Icon as TablerIcon } from "@tabler/icons-react";
import { enlaceWhatsapp } from "@/lib/negocios-verdes";
import { negocioPublicoPorSlug } from "@/lib/negocios-verdes-data";
import { aPuntoMapa } from "@/lib/negocios-verdes-mapa";
import { LOGO_PROGRAMA_NV, urlPublicaNV } from "@/lib/negocios-verdes-sitio";
import { Reconocimientos } from "@/components/negocios-verdes/TarjetaNegocio";
import { CompartirNV, QrNegocioNV } from "@/components/negocios-verdes/sitio/FichaAccionesNV";
import { MapaResultadosNV } from "@/components/negocios-verdes/sitio/MapaResultadosNV";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const n = await negocioPublicoPorSlug(decodeURIComponent(slug)).catch(() => null);
  if (!n) return { title: "Negocio no encontrado" };
  return {
    title: n.nombre,
    description: n.descripcionCorta ?? `${n.categoria.nombre} en ${n.municipio}.`,
    openGraph: { title: n.nombre, description: n.descripcionCorta ?? undefined, images: n.fotoPortadaUrl ? [n.fotoPortadaUrl] : undefined, type: "website", locale: "es_CO" },
    alternates: { canonical: `/negocios-verdes/negocio/${encodeURIComponent(n.slug)}` },
  };
}

function Fila({ icono: Icono, children }: { icono: LucideIcon | TablerIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm tracking-[0.01em]">
      <Icono className="mt-0.5 h-[18px] w-[18px] flex-none text-nv-vivo" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Titulo({ icono: Icono, children }: { icono: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 text-base font-semibold text-nv-oscuro">
      <Icono className="h-[18px] w-[18px]" aria-hidden /> {children}
    </h2>
  );
}

const tarjeta = "rounded-[12px] border border-nv-borde bg-white px-4 py-3.5";
const botonBorde = "inline-flex items-center gap-2 rounded-[8px] border border-nv-vivo bg-white px-6 py-2 text-sm font-semibold text-nv-vivo hover:bg-nv-claro";
const chip = "inline-flex items-center gap-1 rounded-full bg-nv-claro px-3 py-1 text-xs text-nv-texto hover:bg-[#cfe6da]";

/** Ficha pública del negocio, con la misma distribución de la plataforma anterior. */
export default async function FichaNegocioVerde({ params }: Props) {
  const { slug } = await params;
  const n = await negocioPublicoPorSlug(decodeURIComponent(slug));
  if (!n) notFound();

  const whatsapp = enlaceWhatsapp(n.whatsapp, `Hola, vi ${n.nombre} en el directorio de Negocios Verdes de la CDMB y quiero más información.`);
  const punto = aPuntoMapa(n);
  const tel = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;

  // Datos estructurados para buscadores (solo campos públicos; «<» escapado para no cerrar el script).
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: n.nombre,
    description: n.descripcionCorta ?? undefined,
    image: n.fotoPortadaUrl ?? undefined,
    telephone: n.telefono ?? undefined,
    email: n.email ?? n.emailSecundario ?? undefined,
    url: n.sitioWeb ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: n.direccion ?? undefined, addressLocality: n.municipio, addressRegion: "Santander", addressCountry: "CO" },
    geo: n.latitud != null && n.longitud != null ? { "@type": "GeoCoordinates", latitude: n.latitud, longitude: n.longitud } : undefined,
  }).replace(/</g, "\\u003c");

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="relative h-[280px] w-full bg-white">
        <div className="flex h-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={n.fotoPortadaUrl ?? LOGO_PROGRAMA_NV} alt={n.fotoPortadaUrl ? `Foto de ${n.nombre}` : ""} className="max-h-full max-w-full object-contain" />
        </div>
        {n.fotoPortadaUrl && (
          <div className="absolute left-4 top-4 hidden items-center gap-2 rounded-[12px] border border-nv-borde bg-white px-2.5 py-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.10)] sm:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_PROGRAMA_NV} alt="" className="h-9 w-auto" />
            <span className="text-[11px] font-bold leading-tight text-nv-oscuro">
              Negocios Verdes
              <br />
              CDMB
            </span>
          </div>
        )}
        <div className="absolute right-4 top-4">
          <QrNegocioNV slug={n.slug} nombre={n.nombre} base={urlPublicaNV()} />
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Reconocimientos negocio={n} grande />
          {n.categorias.map((c) => (
            <Link key={c.id} prefetch={false} href={`/negocios-verdes/buscar?categoria=${encodeURIComponent(c.slug)}`} className={chip}>
              {c.icono ? `${c.icono} ` : ""}
              {c.nombre}
            </Link>
          ))}
          {n.subcategorias.map((s) => (
            <Link key={s.id} prefetch={false} href={`/negocios-verdes/buscar?subcategoria=${encodeURIComponent(s.slug)}`} className={chip}>
              {s.icono ? `${s.icono} ` : ""}
              {s.nombre}
            </Link>
          ))}
        </div>
        <h1 className="mt-3 text-[28px] font-bold leading-tight">{n.nombre}</h1>
        <p className="mt-1 flex items-start gap-1 text-nv-texto2">
          <MapPin className="mt-1 h-4 w-4 flex-none" aria-hidden />
          <span>{[n.direccion, n.vereda ? `Vereda ${n.vereda}` : null, n.municipio].filter(Boolean).join(" · ")}</span>
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[8px] bg-nv-whatsapp px-6 py-2 text-sm font-semibold text-white hover:brightness-95">
              <IconBrandWhatsapp className="h-5 w-5" aria-hidden /> Escribir por WhatsApp
            </a>
          )}
          <CompartirNV nombre={n.nombre} base={urlPublicaNV()} />
          {n.telefono && (
            <a href={tel(n.telefono)} className={botonBorde}>
              <Phone className="h-[18px] w-[18px]" aria-hidden /> {n.telefono}
            </a>
          )}
          {n.telefonoSecundario && (
            <a href={tel(n.telefonoSecundario)} className={botonBorde}>
              <Phone className="h-[18px] w-[18px]" aria-hidden /> {n.telefonoSecundario}
            </a>
          )}
          {n.facebookUrl && (
            <a href={n.facebookUrl} target="_blank" rel="noopener noreferrer" className={botonBorde}>
              <IconBrandFacebook className="h-[18px] w-[18px]" aria-hidden /> Facebook
            </a>
          )}
          {n.instagramUrl && (
            <a href={n.instagramUrl} target="_blank" rel="noopener noreferrer" className={botonBorde}>
              <IconBrandInstagram className="h-[18px] w-[18px]" aria-hidden /> Instagram
            </a>
          )}
          {n.sitioWeb && (
            <a href={n.sitioWeb} target="_blank" rel="noopener noreferrer" className={botonBorde}>
              <Globe className="h-[18px] w-[18px]" aria-hidden /> Sitio web
            </a>
          )}
        </div>

        <section className="mt-6 rounded-[12px] bg-nv-claro px-4 py-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Contact className="h-[18px] w-[18px] text-nv-oscuro" aria-hidden /> Información de contacto
          </h2>
          <ul className="space-y-2.5">
            <Fila icono={MapPin}>{[n.direccion, n.municipio].filter(Boolean).join(", ")}</Fila>
            {n.whatsapp && <Fila icono={MessageSquare}>{n.whatsapp} (WhatsApp)</Fila>}
            {n.telefono && (
              <Fila icono={Phone}>
                <a href={tel(n.telefono)} className="hover:underline">
                  {n.telefono}
                </a>
              </Fila>
            )}
            {n.email && (
              <Fila icono={Mail}>
                <a href={`mailto:${n.email}`} className="hover:underline">
                  {n.email}
                </a>
              </Fila>
            )}
            {n.emailSecundario && (
              <Fila icono={Mail}>
                <a href={`mailto:${n.emailSecundario}`} className="hover:underline">
                  {n.emailSecundario}
                </a>
              </Fila>
            )}
            {n.representanteLegal && <Fila icono={IconId}>Representante legal: {n.representanteLegal}</Fila>}
          </ul>
        </section>

        {n.descripcion && (
          <section className="mt-6">
            <Titulo icono={Info}>Sobre el negocio</Titulo>
            <div className={`${tarjeta} whitespace-pre-line text-[15px] leading-[1.6]`}>{n.descripcion}</div>
          </section>
        )}

        {n.producto && (
          <section className="mt-6">
            <Titulo icono={ShoppingBag}>Producto o servicio</Titulo>
            <div className={`${tarjeta} text-[15px] leading-[1.4]`}>{n.producto}</div>
          </section>
        )}

        {n.productos.length > 0 && (
          <section className="mt-7">
            <Titulo icono={Star}>Productos destacados</Titulo>
            <ul className="grid gap-4 sm:grid-cols-3">
              {n.productos.map((p) => (
                <li key={p.orden} className="overflow-hidden rounded-[14px] border border-nv-borde bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl} alt={p.nombre ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-nv-claro p-7">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={LOGO_PROGRAMA_NV} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {(p.nombre || p.descripcion) && (
                    <div className="px-3.5 pb-3.5 pt-3">
                      {p.nombre && <p className="text-base font-bold text-nv-oscuro">{p.nombre}</p>}
                      {p.descripcion && <p className="mt-1.5 text-[14.5px] leading-[1.4]">{p.descripcion}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {n.fotos.length > 0 && (
          <section className="mt-7">
            <Titulo icono={Star}>Galería</Titulo>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {n.fotos.map((url) => (
                <li key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-[12px] object-cover" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {punto && (
          <section className="mt-6">
            <Titulo icono={MapaIcono}>Ubicación</Titulo>
            <MapaResultadosNV puntos={[punto]} alto={260} zoom={14} />
            <div className="mt-3 flex flex-wrap gap-3">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${punto.lat},${punto.lng}`} target="_blank" rel="noopener noreferrer" className={botonBorde}>
                <Navigation className="h-[18px] w-[18px]" aria-hidden /> Cómo llegar
              </a>
              <Link prefetch={false} href={`/negocios-verdes/geovisor?negocio=${encodeURIComponent(n.slug)}`} className={botonBorde}>
                <MapaIcono className="h-[18px] w-[18px]" aria-hidden /> Ver en el geovisor
              </Link>
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
