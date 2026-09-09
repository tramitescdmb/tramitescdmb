import type { TipoComunicacion } from "@prisma/client";

/**
 * Barras horizontales por tipo de comunicación con color categórico validado
 * (dataviz skill). Cada barra lleva su valor directo + etiqueta de tipo, así el
 * color nunca es el único canal de identidad.
 */

const COLOR_TIPO: Record<TipoComunicacion, string> = {
  RECIBIDA: "#1c7a45",
  ENVIADA: "#2563eb",
  INTERNA: "#d97706",
};
const ETIQUETA_TIPO: Record<TipoComunicacion, string> = {
  RECIBIDA: "Recibidas",
  ENVIADA: "Enviadas",
  INTERNA: "Memorandos",
};

export function BarrasPorTipo({
  data,
  total,
  mostrarPorcentaje = false,
  emptyMessage,
}: {
  data: { tipo: TipoComunicacion; value: number }[];
  total?: number;
  mostrarPorcentaje?: boolean;
  emptyMessage: string;
}) {
  if (data.length === 0) return <p className="px-1 py-6 text-center text-sm text-stone-400">{emptyMessage}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const suma = total ?? data.reduce((acc, d) => acc + d.value, 0);

  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const pct = suma > 0 ? Math.round((d.value / suma) * 100) : 0;
        return (
          <li key={d.tipo}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-stone-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_TIPO[d.tipo] }} aria-hidden />
                {ETIQUETA_TIPO[d.tipo]}
              </span>
              <span className="tabular-nums font-medium text-stone-800">
                {d.value.toLocaleString("es-CO")}
                {mostrarPorcentaje && <span className="ml-1 font-normal text-stone-400">({pct}%)</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max((d.value / max) * 100, 3)}%`, backgroundColor: COLOR_TIPO[d.tipo] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
