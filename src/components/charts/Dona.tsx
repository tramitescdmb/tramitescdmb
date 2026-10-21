type Segmento = { etiqueta: string; valor: number; color: string; href?: string };

const R = 52;
const GROSOR = 18;
const C = 2 * Math.PI * R;

export function Dona({ segmentos, vacio, unidad }: { segmentos: Segmento[]; vacio: string; unidad: string }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-stone-400">{vacio}</p>;

  let acumulado = 0;
  const arcos = segmentos
    .filter((s) => s.valor > 0)
    .map((s) => {
      const largo = (s.valor / total) * C;
      const arco = { ...s, largo, inicio: acumulado };
      acumulado += largo;
      return arco;
    });
  const separacion = arcos.length > 1 ? 2 : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 140 140" className="h-36 w-36 flex-none" role="img" aria-label={`Distribución de ${total} ${unidad}`}>
        <g transform="rotate(-90 70 70)">
          {arcos.map((a) => {
            const arco = (
            <circle
              key={a.etiqueta}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={GROSOR}
              strokeDasharray={`${Math.max(a.largo - separacion, 0.5)} ${C}`}
              strokeDashoffset={-a.inicio}
              className={`transition-opacity hover:opacity-80 ${a.href ? "cursor-pointer" : ""}`}
            >
              <title>{`${a.etiqueta}: ${a.valor.toLocaleString("es-CO")} (${Math.round((a.valor / total) * 100)} %)`}</title>
            </circle>
            );
            return a.href ? (
              <a key={a.etiqueta} href={a.href} aria-label={`${a.etiqueta}: ${a.valor.toLocaleString("es-CO")}`}>
                {arco}
              </a>
            ) : (
              arco
            );
          })}
        </g>
        <text x={70} y={68} textAnchor="middle" fontSize="22" fontWeight="600" fill="#1b2a20">
          {total.toLocaleString("es-CO")}
        </text>
        <text x={70} y={86} textAnchor="middle" fontSize="10" fill="#76847a">
          {unidad}
        </text>
      </svg>
      <ul className="w-full space-y-0.5 text-xs">
        {arcos.map((a) => {
          const fila = (
            <>
              <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ backgroundColor: a.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-stone-700" title={a.etiqueta}>{a.etiqueta}</span>
              <span className="tabular-nums font-medium text-stone-900">{a.valor.toLocaleString("es-CO")}</span>
              <span className="w-11 whitespace-nowrap text-right tabular-nums text-stone-500">{Math.round((a.valor / total) * 100)} %</span>
            </>
          );
          return (
            <li key={a.etiqueta}>
              {a.href ? (
                <a href={a.href} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-stone-50">
                  {fila}
                </a>
              ) : (
                <div className="flex items-center gap-2 px-1 py-0.5">{fila}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
