import Link from "next/link";
import type { ReactNode } from "react";
import { Leaf } from "lucide-react";

/** Encabezado (hero) de las páginas públicas de «Solicitud ambiental». */
export function EncabezadoSolicitud({ titulo, children, acciones }: { titulo: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cdmb-800 via-cdmb-700 to-cdmb-500 px-5 py-7 text-white shadow-soft sm:px-8 sm:py-9">
      <Leaf className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rotate-12 text-white/10 sm:h-52 sm:w-52" aria-hidden />
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <Leaf className="h-3.5 w-3.5" aria-hidden /> CDMB · Trámites ambientales en línea
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        <div className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">{children}</div>
        {acciones && <div className="mt-5 flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </section>
  );
}

export function BotonEncabezado({ href, children, principal = false }: { href: string; children: ReactNode; principal?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        principal ? "bg-acento-500 text-white shadow-sm hover:bg-acento-600" : "bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25"
      }`}
    >
      {children}
    </Link>
  );
}

/** Pasos del proceso; resalta el actual. */
export function PasosSolicitud({ actual }: { actual?: 1 | 2 | 3 }) {
  const pasos = [
    { n: 1, titulo: "Elija el trámite", texto: "Busque por nombre o explore por recurso natural." },
    { n: 2, titulo: "Diligencie y adjunte", texto: "Datos del solicitante, del lugar y los documentos." },
    { n: 3, titulo: "Reciba su número", texto: "Con él y su cédula o NIT consulta el estado." },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pasos de la solicitud">
      {pasos.map((p) => {
        const esActual = actual === p.n;
        const hecho = actual !== undefined && p.n < actual;
        return (
          <li
            key={p.n}
            aria-current={esActual ? "step" : undefined}
            className={`flex items-start gap-3 rounded-2xl border p-3 ${esActual ? "border-cdmb-300 bg-cdmb-50" : "border-stone-200 bg-white"} ${hecho ? "opacity-70" : ""}`}
          >
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${
                esActual || hecho ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >
              {p.n}
            </span>
            <span>
              <span className="block text-sm font-semibold text-stone-900">{p.titulo}</span>
              <span className="block text-xs text-stone-500">{p.texto}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
