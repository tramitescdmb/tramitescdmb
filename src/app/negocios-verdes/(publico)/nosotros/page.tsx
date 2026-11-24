import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { CATEGORIAS_OFICIALES, RECONOCIMIENTOS_NV } from "@/lib/negocios-verdes-sitio";

export const metadata: Metadata = {
  title: "¿Qué son los Negocios Verdes?",
  description: "La definición oficial de Negocios Verdes, sus 3 categorías y cómo la Ventanilla de Negocios Verdes de la CDMB acompaña a los negocios de los 13 municipios de la jurisdicción.",
};
export const revalidate = 300;

export default async function NosotrosNV() {
  const categorias = await db.nvCategoria.findMany({
    where: { activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      slug: true,
      icono: true,
      subcategorias: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, slug: true, icono: true, actividades: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, slug: true, icono: true } } } },
    },
  });
  const h2 = "text-xl font-semibold text-stone-900";

  return (
    <article className="mx-auto max-w-4xl space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-stone-900">¿Qué son los Negocios Verdes?</h1>
        <blockquote className="rounded-xl border-l-4 border-emerald-600 bg-white p-5 text-stone-700">
          <p>
            Los Negocios Verdes son las actividades económicas que ofrecen bienes y servicios con enfoque ecosistémico y de ciclo de vida, generando impactos sociales y ambientales positivos. Incorporan
            prácticas sostenibles y aportan al desarrollo bajo en carbono y a la resiliencia climática, a partir del uso, transformación, valorización y conservación de los recursos, para contribuir al
            desarrollo de los territorios.
          </p>
          <footer className="mt-2 text-sm text-stone-500">Definición oficial, Plan Nacional de Negocios Verdes 2022-2030 (Ministerio de Ambiente y Desarrollo Sostenible).</footer>
        </blockquote>
      </section>

      <section className="space-y-4">
        <h2 className={h2}>Las 3 categorías oficiales</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CATEGORIAS_OFICIALES.map((c) => {
            const enBase = categorias.find((x) => x.slug.startsWith(c.prefijo) || x.slug.includes(c.prefijo));
            return (
              <div key={c.nombre} className="flex flex-col rounded-xl border border-stone-200 bg-white p-5">
                <h3 className="font-semibold text-stone-900">
                  <span aria-hidden>{c.icono}</span> {c.nombre}
                </h3>
                <p className="mt-2 flex-1 text-sm text-stone-600">{c.texto}</p>
                {enBase && (
                  <Link prefetch={false} href={`/negocios-verdes?categoria=${encodeURIComponent(enBase.slug)}#buscar`} className="mt-3 text-sm font-medium text-emerald-700 hover:underline">
                    Ver negocios de esta categoría →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="space-y-3">
          <h2 className={h2}>Estructura completa de la clasificación</h2>
          <p className="text-sm text-stone-600">Abra una categoría para ver sus subcategorías y actividades productivas; cada actividad lleva a los negocios verdes que la practican.</p>
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {categorias.map((c) => (
              <details key={c.id} className="group px-4 py-3">
                <summary className="cursor-pointer font-medium text-stone-900">
                  {c.icono && <span aria-hidden>{c.icono} </span>}
                  {c.nombre}
                </summary>
                <div className="mt-2 space-y-2 pl-4">
                  {c.subcategorias.map((s) => (
                    <details key={s.id}>
                      <summary className="cursor-pointer text-sm text-stone-800">
                        {s.icono && <span aria-hidden>{s.icono} </span>}
                        {s.nombre}
                      </summary>
                      {s.actividades.length === 0 ? (
                        <p className="py-1 pl-4 text-xs text-stone-500">Sin actividades productivas todavía.</p>
                      ) : (
                        <ul className="space-y-0.5 py-1 pl-4 text-sm">
                          {s.actividades.map((a) => (
                            <li key={a.id}>
                              <Link
                                prefetch={false}
                                href={`/negocios-verdes?categoria=${encodeURIComponent(c.slug)}&subcategoria=${encodeURIComponent(s.slug)}&actividad=${encodeURIComponent(a.slug)}#buscar`}
                                className="text-emerald-700 hover:underline"
                              >
                                {a.icono && <span aria-hidden>{a.icono} </span>}
                                {a.nombre}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className={h2}>¿Qué es la Ventanilla de Negocios Verdes?</h2>
        <p className="text-stone-700">
          Las Ventanillas de Negocios Verdes son los equipos técnicos que cada autoridad ambiental del país conforma para liderar el Programa Regional de Negocios Verdes en su territorio: articulan a los
          actores regionales, hacen seguimiento a los negocios verdes de la zona y generan las estadísticas que miden su aporte al desarrollo económico y a la conservación de los recursos naturales. La
          CDMB tiene la suya para los 13 municipios de su jurisdicción.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className={h2}>Reconocimientos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {RECONOCIMIENTOS_NV.map((r) => (
            <div key={r.nombre} className="rounded-xl border border-stone-200 bg-white p-5">
              <h3 className="font-semibold text-emerald-800">{r.nombre}</h3>
              <p className="mt-2 text-sm text-stone-600">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-emerald-800 p-6 text-white md:flex-row md:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/negocios-verdes/iconografia/frailejon_2.png" alt="" className="h-24 w-24 flex-none object-contain" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Meta nacional a 2030: 12.630 negocios verdes verificados</h2>
          <p className="mt-1 text-sm text-emerald-50">Este directorio es la implementación local de la CDMB del Plan Nacional de Negocios Verdes 2022-2030.</p>
        </div>
        <Link prefetch={false} href="/negocios-verdes/plan-nacional" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
          Conocer el Plan Nacional →
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>¿Cómo hacer parte de los Negocios Verdes de la CDMB?</h2>
        <p className="text-stone-700">
          La vinculación al programa y la verificación de cada negocio las gestiona directamente el equipo de la Ventanilla de Negocios Verdes de la CDMB. Si tiene un negocio verde en alguno de los 13
          municipios de la jurisdicción y quiere más información sobre el proceso, use los canales de contacto.
        </p>
        <Link prefetch={false} href="/negocios-verdes/contacto" className="inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Ir a contacto
        </Link>
      </section>
    </article>
  );
}
