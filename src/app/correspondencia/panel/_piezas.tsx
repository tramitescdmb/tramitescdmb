import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Piezas visuales compartidas por las cuatro vistas del tablero del SGDEA. */

const TONOS: Record<string, string> = {
  neutro: "text-stone-400",
  cdmb: "text-cdmb-600",
  azul: "text-blue-600",
  ambar: "text-amber-600",
  cian: "text-cyan-600",
  rojo: "text-red-600",
  verde: "text-emerald-600",
};

export type TonoKpi = keyof typeof TONOS;

export function Kpi({
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
        <Icon className={`h-4 w-4 ${TONOS[tono]}`} aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value > 0 && tono === "rojo" ? "text-red-600" : "text-stone-900"}`}>
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

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-5">{children}</div>;
}

/** Encabezado de un bloque dentro de una vista (no confundir con el título de la vista). */
export function BloqueTitulo({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 border-b-2 border-cdmb-600 pb-1.5 text-lg font-semibold text-stone-900">
      <Icon className="h-5 w-5 text-cdmb-600" aria-hidden /> {children}
    </h2>
  );
}
