import type { Metadata } from "next";
import { BandaTituloNV } from "@/components/negocios-verdes/sitio/BandaTituloNV";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Plan Nacional de Negocios Verdes 2022-2030",
  description:
    "Propósito, objetivos, metas a 2030 y líneas estratégicas del Plan Nacional de Negocios Verdes 2022-2030 del Ministerio de Ambiente y Desarrollo Sostenible.",
};

const METAS = [
  ["12.630", "negocios verdes verificados"],
  ["150 mil", "empleos verdes e inclusivos"],
  ["$2,1 billones", "en ingresos generados"],
];
const ENFOQUES = [
  [
    "Social",
    "Pone a las economías populares y comunidades en el centro del Plan: empoderamiento, saberes ancestrales y enfoque diferencial (étnico, jóvenes, género, campesino), buscando que la riqueza natural también genere riqueza monetaria para quienes cuidan los ecosistemas.",
  ],
  [
    "Ambiental",
    "El impacto ambiental positivo es la razón principal de los negocios verdes: conservación, cambio de materiales y energías no renovables por renovables, mantenimiento de la biodiversidad y de servicios ecosistémicos, y reducción de emisiones de gases efecto invernadero.",
  ],
  [
    "Económico",
    "Impulsa la transición hacia una economía de la biodiversidad: instrumentos económicos y financieros, circuitos cortos de comercialización, encadenamientos regionales y consumo responsable en instituciones públicas, empresas privadas y clientes finales.",
  ],
];
const LINEAS = [
  "Alianzas, articulación y política",
  "Sistema de información, monitoreo y seguimiento",
  "Instrumentos económicos, financieros e incentivos",
  "Consumo responsable y sostenible",
  "Fortalecimiento de capacidades",
  "Desarrollo y fortalecimiento de la oferta",
  "Investigación, desarrollo e innovación",
  "Acceso a mercados",
];
const OBJETIVOS = [
  "Desarrollar e implementar una ruta de acompañamiento replicable para aumentar la oferta de emprendimientos verdes inclusivos en los territorios, con el apoyo de todo el Sistema Nacional Ambiental.",
  "Fortalecer y escalar negocios verdes verificados con presencia en mercados regionales, nacionales e internacionales, con reportes de indicadores de sostenibilidad.",
  "Fortalecer los mercados de los negocios verdes con la integración de empresas ancla que cumplen indicadores de sostenibilidad e incorporan negocios verdes en redes de suministro y cadenas de valor.",
];

export default function PlanNacionalNV() {
  const h2 = "text-xl font-semibold text-nv-texto";
  return (
    <>
      <BandaTituloNV titulo="Plan Nacional de Negocios Verdes 2022-2030" />
      <article className="mx-auto max-w-[760px] space-y-10 px-5 py-7">
        <header>
          <p className="mt-1 text-nv-texto2">
            Ministerio de Ambiente y Desarrollo Sostenible de Colombia
          </p>
        </header>
        <section className="space-y-2">
          <h2 className={h2}>Propósito superior</h2>
          <p className="text-nv-texto">
            En 2030 los negocios verdes serán un renglón de impacto social y
            ambiental en la economía nacional, competitivos, inclusivos y
            sostenibles, contribuyendo al desarrollo bajo en carbono y
            resiliente al clima, así como al aprovechamiento y conservación de
            capital natural que soporta el desarrollo de los territorios.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className={h2}>Objetivo general</h2>
          <p className="text-nv-texto">
            Incrementar y consolidar los negocios verdes que generan impacto
            ambiental positivo, empleo verde inclusivo e impulsan el crecimiento
            verde del país, incentivando el consumo consciente y sostenible.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className={h2}>Objetivos específicos</h2>
          <ol className="list-decimal space-y-2 pl-5 text-nv-texto">
            {OBJETIVOS.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </section>
        <section className="space-y-3">
          <h2 className={h2}>Meta a 2030</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            {METAS.map(([n, t]) => (
              <div
                key={t}
                className="rounded-[12px] bg-nv-oscuro p-5 text-white"
              >
                <dt className="text-3xl font-bold">{n}</dt>
                <dd className="text-sm text-white/90">{t}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="space-y-3">
          <h2 className={h2}>Tres enfoques</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ENFOQUES.map(([n, t]) => (
              <div
                key={n}
                className="rounded-[12px] border border-nv-borde bg-white p-5"
              >
                <h3 className="font-semibold text-nv-oscuro">{n}</h3>
                <p className="mt-2 text-sm text-nv-texto2">{t}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className={h2}>8 líneas estratégicas</h2>
          <p className="text-nv-texto">
            El plan de acción hacia 2030 se organiza en 8 líneas estratégicas de
            intervención: cuatro transversales y de soporte, y cuatro con
            alcance específico.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {LINEAS.map((l, i) => (
              <li
                key={l}
                className="flex items-center gap-3 rounded-[8px] border border-nv-borde bg-white px-4 py-2.5 text-sm text-nv-texto"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-nv-claro font-semibold text-nv-oscuro">
                  {i + 1}
                </span>
                {l}
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-[12px] border border-nv-borde bg-white p-4 text-sm text-nv-texto2">
          <strong>Fuente:</strong> Plan Nacional de Negocios Verdes 2022-2030.
          Ministerio de Ambiente y Desarrollo Sostenible, Colombia (2022). Banco
          Interamericano de Desarrollo (BID), Biointropic y Corporación
          Biocomercio Sostenible.
        </section>
        <div className="flex flex-wrap gap-3">
          <Link
            prefetch={false}
            href="/negocios-verdes/nosotros"
            className="rounded-[8px] border border-nv-vivo bg-white px-4 py-2 text-sm font-semibold text-nv-vivo hover:bg-nv-claro"
          >
            ← ¿Qué son los Negocios Verdes?
          </Link>
          <Link
            prefetch={false}
            href="/negocios-verdes#buscar"
            className="rounded-[8px] bg-nv-acento px-4 py-2 text-sm font-semibold text-white hover:bg-nv-acento-oscuro"
          >
            Explorar negocios
          </Link>
        </div>
      </article>
    </>
  );
}
