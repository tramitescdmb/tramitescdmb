type Punto = { anio: number; valor: number };

const COLOR = "#2a78d6";
const W = 720;
const H = 220;
const PADL = 30;
const PADR = 22;
const PADT = 22;
const PADB = 22;
const clampX = (v: number) => Math.min(Math.max(v, 14), W - 14);

/**
 * Área ("montaña") de un conteo anual. A diferencia de AreaTrendChart, deja
 * los valores visibles siempre (con anticolisión) además del hover, y rotula
 * el eje de años. Una sola serie → un solo tono secuencial.
 */
export function AreaAnual({ data, emptyMessage }: { data: Punto[]; emptyMessage: string }) {
  const totalV = data.reduce((s, d) => s + d.valor, 0);
  if (data.length < 2 || totalV === 0) {
    return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  }

  const innerW = W - PADL - PADR;
  const innerH = H - PADT - PADB;
  const max = Math.max(...data.map((d) => d.valor), 1);
  const x = (i: number) => PADL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PADT + innerH - (v / max) * innerH;

  const pts = data.map((d, i) => ({ ...d, x: x(i), y: y(d.valor) }));
  const lineaPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${lineaPath} L ${pts[pts.length - 1].x.toFixed(1)} ${PADT + innerH} L ${pts[0].x.toFixed(1)} ${PADT + innerH} Z`;

  // Etiquetas de valor: siempre el máximo y el último; el resto si hay espacio.
  const idxMax = pts.reduce((m, p, i) => (p.valor > pts[m].valor ? i : m), 0);
  let ultimoLabelX = -Infinity;
  const mostrarValor = pts.map((p, i) => {
    if (p.valor === 0) return false;
    if (i === idxMax || i === pts.length - 1) {
      ultimoLabelX = p.x;
      return true;
    }
    if (p.x - ultimoLabelX >= innerW / 9) {
      ultimoLabelX = p.x;
      return true;
    }
    return false;
  });

  const pasoAnio = Math.max(1, Math.ceil(data.length / 10));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img" aria-label="Conteo por año">
        <line x1={PADL} y1={PADT + innerH} x2={W - PADR} y2={PADT + innerH} stroke="#e1e0d9" strokeWidth={1} />
        <path d={areaPath} fill={COLOR} opacity={0.12} />
        <path d={lineaPath} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => (
          <g key={p.anio} tabIndex={0} className="group outline-none">
            <rect x={p.x - innerW / data.length / 2} y={PADT} width={innerW / data.length} height={innerH} fill="transparent" />
            <line x1={p.x} y1={PADT} x2={p.x} y2={PADT + innerH} stroke={COLOR} strokeWidth={1} opacity={0} className="transition-opacity group-hover:opacity-30 group-focus-visible:opacity-30" />
            <circle cx={p.x} cy={p.y} r={2.5} fill={COLOR} opacity={mostrarValor[i] ? 1 : 0} className="transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            {mostrarValor[i] && (
              <text x={clampX(p.x)} y={p.y - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill="#3f3f46">
                {p.valor.toLocaleString("es-CO")}
              </text>
            )}
            <title>{`${p.anio}: ${p.valor.toLocaleString("es-CO")}`}</title>
            {i % pasoAnio === 0 || i === pts.length - 1 ? (
              <text x={clampX(p.x)} y={H - 6} textAnchor="middle" fontSize="9" fill="#8b8781">
                {p.anio}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
