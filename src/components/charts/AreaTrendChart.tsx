type Point = { label: string; value: number };

const LINE_COLOR = "#2a78d6"; // mismo azul secuencial que BarChartHorizontal — una sola serie

const WIDTH = 600;
const HEIGHT = 180;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

export function AreaTrendChart({ data, emptyMessage }: { data: Point[]; emptyMessage: string }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (data.length < 2 || total === 0) {
    return <p className="px-1 py-8 text-center text-sm text-gray-400">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = PAD_LEFT + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = PAD_TOP + innerH - (d.value / max) * innerH;
    return { ...d, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_TOP + innerH} L ${points[0].x} ${PAD_TOP + innerH} Z`;
  const baselineY = PAD_TOP + innerH;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Tendencia de solicitudes en el tiempo">
      <line x1={PAD_LEFT} y1={baselineY} x2={WIDTH - PAD_RIGHT} y2={baselineY} stroke="#e1e0d9" strokeWidth={1} />
      <path d={areaPath} fill={LINE_COLOR} opacity={0.1} />
      <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const showLabelEvery = Math.ceil(points.length / 6);
        const showAxisLabel = i % showLabelEvery === 0 || isLast;
        return (
          <g key={p.label + i} className="group outline-none" tabIndex={0}>
            <rect
              x={p.x - innerW / data.length / 2}
              y={PAD_TOP}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
            />
            {showAxisLabel && (
              <text x={p.x} y={HEIGHT - 6} textAnchor="middle" fontSize="9" fill="#898781">
                {p.label}
              </text>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={isLast ? 4 : 3}
              fill={LINE_COLOR}
              stroke="#fcfcfb"
              strokeWidth={2}
              opacity={isLast ? 1 : 0}
              className="transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />

            {/* Tooltip: valor y punto, aparece en hover/foco */}
            <g
              opacity={0}
              className="pointer-events-none transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              transform={`translate(${Math.min(Math.max(p.x, 42), WIDTH - 42)}, ${Math.max(p.y - 14, 12)})`}
            >
              <rect x={-38} y={-16} width={76} height={20} rx={4} fill="#0b0b0b" />
              <text x={0} y={-2} textAnchor="middle" fontSize="10" fill="#ffffff">
                <tspan fontWeight="600">{p.value.toLocaleString("es-CO")}</tspan> · {p.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* valor final, directo sobre el último punto (regla: "Lines → value at the end") */}
      <text
        x={Math.min(points[points.length - 1].x + 6, WIDTH - 4)}
        y={points[points.length - 1].y - 6}
        fontSize="10"
        fontWeight="600"
        fill="#0b0b0b"
      >
        {points[points.length - 1].value.toLocaleString("es-CO")}
      </text>
    </svg>
  );
}
