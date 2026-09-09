import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Piezas visuales del SGDEA — un solo lugar para el aspecto de encabezados,
 * tarjetas de indicador, paneles y estados vacíos, para que la bandeja, los
 * expedientes, la disposición final y el tablero se vean igual.
 */

/* ------------------------------------------------------------------ Encabezados */

/** Título de una sección: subrayado verde CDMB, con conteo y acción opcionales. */
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

/** Subtítulo simple dentro de un panel. */
export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}

/* ------------------------------------------------------------------ Contenedores */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white p-5 ${className}`}>{children}</div>;
}

/** Estado vacío uniforme (misma caja que un panel, texto centrado y tenue). */
export function EstadoVacio({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-400">
      {Icon && <Icon className="mx-auto mb-2 h-6 w-6 text-stone-300" aria-hidden />}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Indicadores */

const TONOS_KPI: Record<string, string> = {
  neutro: "text-stone-400",
  cdmb: "text-cdmb-600",
  azul: "text-blue-600",
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
    <div className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300">
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
