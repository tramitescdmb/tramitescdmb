import Link from "next/link";
import { CalendarDays } from "lucide-react";

export function SelectorAnios({
  anios,
  actual,
  total,
  href,
}: {
  anios: { anio: number; total: number }[];
  actual: string;
  total: number;
  href: (valor: string) => string;
}) {
  const opciones = [...anios.map((a) => ({ valor: String(a.anio), etiqueta: String(a.anio), total: a.total })), { valor: "todas", etiqueta: "Todos", total }];
  return (
    <nav aria-label="Vigencia" className="flex flex-wrap items-center gap-1">
      <CalendarDays className="mr-1 h-4 w-4 text-stone-400" aria-hidden />
      {opciones.map((o) => {
        const activo = o.valor === actual;
        return (
          <Link
            key={o.valor}
            href={href(o.valor)}
            aria-current={activo ? "true" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-medium tabular-nums transition ${
              activo ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {o.etiqueta}
            <span className={activo ? "text-white/80" : "text-stone-400"}>{o.total.toLocaleString("es-CO")}</span>
          </Link>
        );
      })}
    </nav>
  );
}
