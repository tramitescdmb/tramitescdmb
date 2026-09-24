import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function TituloSeccion({
  icon: Icon,
  children,
  contador,
  accion,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  contador?: number;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-cdmb-600 pb-1.5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
        {Icon && <Icon className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />}
        {children}
        {contador !== undefined && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500">
            {contador.toLocaleString("es-CO")}
          </span>
        )}
      </h2>
      {accion && <div className="text-xs">{accion}</div>}
    </div>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-100 bg-white p-5 shadow-soft ${className}`}>{children}</div>;
}

export function EstadoVacio({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white px-4 py-10 text-center text-sm text-stone-400 shadow-soft">
      {Icon && <Icon className="mx-auto mb-2 h-6 w-6 text-stone-300" aria-hidden />}
      {children}
    </div>
  );
}

const TONOS_KPI: Record<string, string> = {
  neutro: "text-stone-400",
  cdmb: "text-cdmb-600",
  azul: "text-techblue-600",
  ambar: "text-amber-600",
  cian: "text-cyan-600",
  rojo: "text-red-600",
  verde: "text-emerald-600",
};

export type TonoKpi = keyof typeof TONOS_KPI;

export function TarjetaKpi({
  icon: Icon,
  label,
  value,
  tono = "neutro",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tono?: TonoKpi;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg">
      <div className="flex items-center gap-2 text-stone-400">
        <Icon className={`h-4 w-4 ${TONOS_KPI[tono]}`} aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          value > 0 && tono === "rojo" ? "text-red-600" : "text-stone-900"
        }`}
      >
        {value.toLocaleString("es-CO")}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200/70 ${className}`} />;
}

export function EsqueletoTitulo() {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b-2 border-stone-100 pb-1.5">
      <Esqueleto className="h-5 w-56" />
      <Esqueleto className="h-4 w-16" />
    </div>
  );
}

export function EsqueletoTablero({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: tarjetas }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-stone-100 bg-white p-4 shadow-soft">
            <Esqueleto className="h-3 w-20" />
            <Esqueleto className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-soft">
        <Esqueleto className="mb-3 h-4 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EsqueletoLista({ filas = 8 }: { filas?: number }) {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <Esqueleto className="h-9 w-full max-w-md" />
      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-soft">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Esqueleto className="h-4 flex-1" />
            <Esqueleto className="h-4 w-20" />
            <Esqueleto className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoDetalle() {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <Esqueleto className="h-4 w-2/3" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <Esqueleto className="mb-3 h-4 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EsqueletoFormulario({ campos = 5 }: { campos?: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EsqueletoTitulo />
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        {Array.from({ length: campos }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Esqueleto className="h-3 w-32" />
            <Esqueleto className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
