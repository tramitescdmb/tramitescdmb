import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Leaf, MapPin, Network, Shapes, Store, Tag, Workflow } from "lucide-react";
import { MUNICIPIOS_NV } from "@/lib/negocios-verdes";
import { configuracionPublicaNV, listarNegociosPublicos, taxonomiaPublicaNV } from "@/lib/negocios-verdes-data";
import { TarjetaNegocio } from "@/components/negocios-verdes/TarjetaNegocio";
import { BuscadorInicioNV, CarruselNV, FiltrosInicioNV, type DiapositivaNV } from "@/components/negocios-verdes/sitio/InicioNV";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Onda divisora entre franjas (misma curva de la plataforma anterior). */
function Onda({ fondo, onda }: { fondo: string; onda: string }) {
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="-mb-px block h-[34px] w-full" style={{ background: fondo }} aria-hidden>
      <path d="M0 18.7 Q25 0 50 13.6 T100 6.8 V34 H0 Z" fill={onda} />
    </svg>
  );
}

const PILARES = [
  { icono: BadgeCheck, titulo: "Verificados por la CDMB", texto: "Cada negocio pasa por un proceso real de verificación de la Ventanilla de Negocios Verdes antes de aparecer en este directorio." },
  { icono: Leaf, titulo: "Impacto ambiental positivo", texto: "Prácticas que protegen los recursos naturales y la biodiversidad en los 13 municipios de la jurisdicción de la CDMB." },
  {
    icono: Network,
    titulo: "Parte del Plan Nacional",
    texto: "Cada negocio queda clasificado bajo las 3 categorías, 12 subcategorías y 29 actividades productivas oficiales del Plan Nacional de Negocios Verdes 2022-2030.",
  },
];

export default async function NegociosVerdesInicio({ searchParams }: Props) {
  // Enlaces viejos del buscador (/negocios-verdes?q=…) siguen funcionando: van al buscador.
  const sp = await searchParams;
  const viejo = new URLSearchParams();
  for (const k of ["q", "municipio", "categoria", "subcategoria", "actividad", "reconocimiento", "pagina"]) {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) viejo.set(k, v.trim().slice(0, 120));
  }
  if (viejo.size > 0) redirect(`/negocios-verdes/buscar?${viejo}`);

  const [todos, nv, categorias] = await Promise.all([listarNegociosPublicos(), configuracionPublicaNV(), taxonomiaPublicaNV()]);
  const destacados = todos.filter((n) => n.destacado).slice(0, 6);
  const subcategorias = categorias.reduce((s, c) => s + c.subcategorias.length, 0);
  const actividades = categorias.reduce((s, c) => s + c.subcategorias.reduce((t, x) => t + x.actividades.length, 0), 0);

  const banners: DiapositivaNV[] = nv.banners
    .filter((b): b is typeof b & { imagenUrl: string } => Boolean(b.imagenUrl))
    .map((b) => ({ tipo: "imagen", imagenUrl: b.imagenUrl, destino: b.urlDestino, nuevaPestana: b.abrirEnPestanaNueva }));
  const diapositivas: DiapositivaNV[] = banners.length
    ? banners
    : [
        { tipo: "texto", titulo: "Negocios Verdes CDMB", subtitulo: `${todos.length} negocios verdes en los 13 municipios de la jurisdicción CDMB`, fondo: "#85c800", oscuro: true },
        { tipo: "texto", titulo: "¿Qué son los Negocios Verdes?", subtitulo: "Conoce los requisitos y beneficios de hacer parte del programa de la CDMB.", fondo: "#ff8623", oscuro: true, boton: "Conocer más", destino: "/negocios-verdes/nosotros" },
        { tipo: "texto", titulo: "Encuentra por categoría", subtitulo: "Agrosistemas, turismo sostenible, biocomercio, tecnologías verdes y más.", fondo: "#01bd32", oscuro: true, boton: "Ver categorías", destino: "/negocios-verdes/buscar" },
        { tipo: "texto", titulo: "13 municipios, un solo directorio", subtitulo: "Bucaramanga, Floridablanca, Girón, Piedecuesta y 9 municipios más de la jurisdicción CDMB.", fondo: "#20272a", oscuro: false, boton: "Buscar por municipio", destino: "/negocios-verdes/buscar" },
      ];

  const cifras = [
    { icono: MapPin, etiqueta: "Municipios", valor: MUNICIPIOS_NV.length },
    { icono: Shapes, etiqueta: "Categorías", valor: categorias.length },
    { icono: Tag, etiqueta: "Subcategorías", valor: subcategorias },
    { icono: Workflow, etiqueta: "Actividades productivas", valor: actividades },
    { icono: Store, etiqueta: "Negocios verdes", valor: todos.length },
  ];

  return (
    <div>
      <CarruselNV diapositivas={diapositivas} />
      <BuscadorInicioNV sugerencias={todos.map((n) => n.nombre)} />

      {destacados.length > 0 && (
        <section className="px-5 pb-2 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-semibold">Negocios destacados</h2>
            <Link prefetch={false} href="/negocios-verdes/buscar" className="text-sm font-semibold text-nv-vivo hover:underline">
              Ver todos
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {destacados.map((n) => (
              <li key={n.id} className="flex">
                <TarjetaNegocio negocio={n} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <FiltrosInicioNV categorias={categorias} />

      <div className="mt-2">
        <Onda fondo="#faf8f3" onda="#85c800" />
        <section className="bg-nv-menu px-5 py-7">
          <div className="mx-auto max-w-[820px] text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/negocios-verdes/iconografia/oso_anteojos_1.png" alt="" className="mx-auto h-16 w-auto" />
            <dl className="mt-3 flex flex-wrap justify-evenly gap-y-5">
              {cifras.map(({ icono: Icono, etiqueta, valor }) => (
                <div key={etiqueta} className="flex w-[140px] flex-col items-center">
                  <Icono className="h-[22px] w-[22px]" aria-hidden />
                  <dt className="order-3 mt-1 text-[13px] font-medium">{etiqueta}</dt>
                  <dd className="order-2 mt-1.5 text-[32px] font-bold leading-none">{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <Onda fondo="#85c800" onda="#dceee6" />
      </div>

      <section className="bg-gradient-to-b from-nv-claro to-nv-fondo px-5 py-11 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/negocios-verdes/iconografia/frailejon_1.png" alt="" className="h-[34px] w-[34px] object-contain" />
        </span>
        <h2 className="mt-4 text-2xl font-bold">¿Qué son los Negocios Verdes?</h2>
        <p className="mx-auto mt-2.5 max-w-[560px] text-[15px] text-nv-texto2">
          Son emprendimientos y empresas que ofrecen bienes y servicios con impacto ambiental positivo, verificados por la Ventanilla de Negocios Verdes en los 13 municipios de la jurisdicción de la CDMB.
        </p>
        <div className="mx-auto mt-8 grid max-w-[900px] gap-4 text-left md:grid-cols-3">
          {PILARES.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="rounded-[16px] bg-white p-5 shadow-[0_4px_14px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nv-claro text-nv-vivo">
                <Icono className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-6 text-[15px] font-semibold">{titulo}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.4] text-nv-texto2">{texto}</p>
            </div>
          ))}
        </div>
        <Link prefetch={false} href="/negocios-verdes/nosotros" className="mt-7 inline-flex items-center gap-2 rounded-[8px] bg-nv-acento px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nv-acento-oscuro">
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden /> Conocer más
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/negocios-verdes/iconografia/logo_feria_nv.png" alt="Feria Regional de Negocios Verdes" className="mx-auto mt-7 h-12 w-auto" />
      </section>
    </div>
  );
}
