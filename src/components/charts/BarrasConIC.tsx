type Item = { label: string; valor: number; lo: number; hi: number; nota?: string };

const COLOR = "#2a78d6";

/**
 * Barras horizontales de una proporción (0–1) con su intervalo de confianza
 * del 95 % dibujado como bigote. Para comparar tasas entre categorías sin
 * confundir ruido con señal (categorías con pocos casos tienen IC ancho).
 */
export function BarrasConIC({
  data,
  emptyMessage,
  formato = (v: number) => `${(v * 100).toFixed(1)} %`,
}: {
  data: Item[];
  emptyMessage: string;
  formato?: (v: number) => string;
}) {
  if (data.length === 0) return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  const max = Math.max(...data.map((d) => d.hi), 0.001);

  return (
    <ul className="space-y-3">
      {data.map((item) => {
        const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
        return (
          <li key={item.label} tabIndex={0} className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate pr-2 text-stone-700">{item.label}</span>
              <span className="flex-none tabular-nums text-stone-500">
                {formato(item.valor)}
                {item.nota && <span className="ml-1 text-stone-400">{item.nota}</span>}
              </span>
            </div>
            <div className="relative h-2.5">
              <div className="absolute inset-y-0 left-0 rounded-full bg-stone-100" style={{ width: "100%" }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(item.valor), backgroundColor: COLOR }} />
              {/* intervalo de confianza */}
              <div
                className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full border-x-2 border-stone-500/70"
                style={{ left: w(item.lo), width: `calc(${w(item.hi)} - ${w(item.lo)})` }}
                title={`IC 95 %: ${formato(item.lo)} – ${formato(item.hi)}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
