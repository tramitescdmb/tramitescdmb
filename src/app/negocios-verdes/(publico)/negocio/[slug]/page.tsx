import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Leaf, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { IconBrandFacebook, IconBrandInstagram, IconBrandWhatsapp, type Icon as TablerIcon } from "@tabler/icons-react";
import { enlaceWhatsapp } from "@/lib/negocios-verdes";
import { negocioPublicoPorSlug } from "@/lib/negocios-verdes-data";
import { Reconocimientos } from "@/components/negocios-verdes/TarjetaNegocio";

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

function Dato({ icono: Icono, children }: { icono: LucideIcon | TablerIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-stone-700">
      <Icono className="mt-0.5 h-4 w-4 flex-none text-emerald-700" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export default async function FichaNegocioVerde({ params }: Props) {
  const { slug } = await params;
  const n = await negocioPublicoPorSlug(decodeURIComponent(slug));
  if (!n) notFound();

  const whatsapp = enlaceWhatsapp(n.whatsapp, `Hola, vi ${n.nombre} en el directorio de Negocios Verdes de la CDMB.`);
  const mapa =
    n.latitud != null && n.longitud != null
      ? `https://www.openstreetmap.org/?mlat=${n.latitud}&mlon=${n.longitud}#map=16/${n.latitud}/${n.longitud}`
      : null;

  // Datos estructurados para buscadores (solo campos públicos; «<» escapado para no cerrar el script).
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: n.nombre,
    description: n.descripcionCorta ?? undefined,
    image: n.fotoPortadaUrl ?? undefined,
    telephone: n.telefono ?? undefined,
    email: n.email ?? undefined,
    url: n.sitioWeb ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: n.direccion ?? undefined, addressLocality: n.municipio, addressRegion: "Santander", addressCountry: "CO" },
    geo: n.latitud != null && n.longitud != null ? { "@type": "GeoCoordinates", latitude: n.latitud, longitude: n.longitud } : undefined,
  }).replace(/</g, "\\u003c");

  return (
    <article className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Link prefetch={false} href="/negocios-verdes#buscar" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al directorio
      </Link>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-emerald-50">
            {n.fotoPortadaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.fotoPortadaUrl} alt={`Foto de ${n.nombre}`} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center text-emerald-300">
                <Leaf className="h-16 w-16" aria-hidden />
              </div>
            )}
          </div>

          <header className="space-y-2">
            <p className="text-sm font-medium text-emerald-700">{n.categorias.map((c) => `${c.icono ? `${c.icono} ` : ""}${c.nombre}`).join(" · ")}</p>
            <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{n.nombre}</h1>
            <div className="flex flex-wrap gap-1.5">
              <Reconocimientos negocio={n} grande />
            </div>
          </header>

          {n.descripcionCorta && <p className="text-base font-medium text-stone-800">{n.descripcionCorta}</p>}
          {n.descripcion && <div className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{n.descripcion}</div>}

          {(n.subcategorias.length > 0 || n.actividades.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {[...n.subcategorias, ...n.actividades].map((t) => (
                <span key={t.id} className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs text-emerald-800">
                  {t.nombre}
                </span>
              ))}
            </div>
          )}

          {n.productos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-stone-900">Productos destacados</h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                {n.productos.map((p) => (
                  <li key={p.orden} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                    {p.fotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotoUrl} alt={p.nombre ?? ""} loading="lazy" className="aspect-square w-full object-cover" />
                    )}
                    <div className="space-y-1 p-3">
                      {p.nombre && <p className="text-sm font-semibold text-stone-900">{p.nombre}</p>}
                      {p.descripcion && <p className="text-xs text-stone-600">{p.descripcion}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {n.fotos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-stone-900">Galería</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {n.fotos.map((url) => (
                  <li key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
              >
                <IconBrandWhatsapp className="h-4 w-4" aria-hidden /> Escribir por WhatsApp
              </a>
            )}
            <ul className="space-y-2.5">
              <Dato icono={MapPin}>
                {[n.direccion, n.vereda, n.municipio].filter(Boolean).join(", ")}
                {mapa && (
                  <>
                    {" · "}
                    <a href={mapa} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">
                      Ver en el mapa
                    </a>
                    {" · "}
                    <Link prefetch={false} href={`/negocios-verdes/geovisor?v=${n.latitud},${n.longitud},16&capas=municipios,areas`} className="font-medium text-emerald-700 hover:underline">
                      Ver en el geovisor
                    </Link>
                  </>
                )}
              </Dato>
              {n.telefono && (
                <Dato icono={Phone}>
                  <a href={`tel:${n.telefono.replace(/[^\d+]/g, "")}`} className="hover:underline">
                    {n.telefono}
                  </a>
                  {n.telefonoSecundario ? ` · ${n.telefonoSecundario}` : ""}
                </Dato>
              )}
              {n.email && (
                <Dato icono={Mail}>
                  <a href={`mailto:${n.email}`} className="hover:underline">
                    {n.email}
                  </a>
                </Dato>
              )}
              {n.sitioWeb && (
                <Dato icono={Globe}>
                  <a href={n.sitioWeb} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {n.sitioWeb.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </Dato>
              )}
              {n.facebookUrl && (
                <Dato icono={IconBrandFacebook}>
                  <a href={n.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Facebook
                  </a>
                </Dato>
              )}
              {n.instagramUrl && (
                <Dato icono={IconBrandInstagram}>
                  <a href={n.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Instagram
                  </a>
                </Dato>
              )}
            </ul>
            {n.representanteLegal && <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">Representante: {n.representanteLegal}</p>}
          </div>
          <p className="text-xs text-stone-500">
            La información de contacto la suministra cada negocio. La CDMB no vende productos ni servicios desde este directorio.
          </p>
        </aside>
      </div>
    </article>
  );
}
