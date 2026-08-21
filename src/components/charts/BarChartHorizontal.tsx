type Item = { label: string; value: number };

const BAR_COLOR = "#2a78d6"; // azul secuencial validado (dataviz skill) — magnitud, una sola serie

export function BarChartHorizontal({
  data,
  emptyMessage,
  formatValue = (n) => n.toLocaleString("es-CO"),
}: {
  data: Item[];
  emptyMessage: string;
  formatValue?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-gray-400">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-2.5">
      {data.map((item) => {
        const pct = Math.max((item.value / max) * 100, 2);
        return (
          <li key={item.label} tabIndex={0} className="group relative rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="truncate pr-2 text-gray-700">{item.label}</span>
              <span className="flex-none tabular-nums text-gray-500">{formatValue(item.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-[filter] group-hover:brightness-110"
                style={{ width: `${pct}%`, backgroundColor: BAR_COLOR }}
              />
            </div>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-7 left-0 z-10 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white group-hover:block group-focus-visible:block"
            >
              <span className="font-semibold">{formatValue(item.value)}</span> — {item.label}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
