type Punto = { anio: number; valor: number };
type Proy = { anio: number; valor: number; lo: number; hi: number };

const COLOR = "#2a78d6"; // azul secuencial validado — una sola serie

const W = 640;
const H = 240;
const PADL = 34;
const PADR = 12;
const PADT = 14;
const PADB = 26;

/**
 * Serie histórica (línea sólida) + proyección por regresión lineal (línea
 * punteada) con banda de predicción ~95 % (área sombreada). Un solo eje.
 */
export function ForecastChart({
  historico,
  proyeccion,
  emptyMessage,
}: {
  historico: Punto[];
  proyeccion: Proy[];
  emptyMessage: string;
}) {
  if (historico.length < 3) {
    return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  }

  const puntos = [
    ...historico.map((h) => ({ ...h, hi: h.valor, lo: h.valor, proy: false })),
    ...proyeccion.map((p) => ({ ...p, proy: true })),
  ];
  const minA = puntos[0].anio;
  const maxA = puntos[puntos.length - 1].anio;
  const maxV = Math.max(...puntos.map((p) => p.hi), 1) * 1.08;

  const x = (a: number) => PADL + ((a - minA) / (maxA - minA)) * (W - PADL - PADR);
  const y = (v: number) => PADT + (1 - v / maxV) * (H - PADT - PADB);

  const linea = (pts: { anio: number; valor: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.anio).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(" ");

  const hist = historico;
  const ultimoHist = hist[hist.length - 1];
  const proyConAncla = [{ anio: ultimoHist.anio, valor: ultimoHist.valor, lo: ultimoHist.valor, hi: ultimoHist.valor }, ...proyeccion];

  const banda =
    proyConAncla.map((p) => `${x(p.anio).toFixed(1)} ${y(p.hi).toFixed(1)}`).join(" L ") +
    " L " +
    [...proyConAncla].reverse().map((p) => `${x(p.anio).toFixed(1)} ${y(p.lo).toFixed(1)}`).join(" L ");

  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxV / ticks) * i));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img" aria-label="Proyección de resoluciones por año">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PADL} y1={y(v)} x2={W - PADR} y2={y(v)} stroke="#ece9e3" strokeWidth={1} />
            <text x={PADL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#8b8781">
              {v.toLocaleString("es-CO")}
            </text>
          </g>
        ))}

        <path d={`M ${banda} Z`} fill={COLOR} opacity={0.12} />

        <path d={linea(hist)} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" />
        <path
          d={linea([{ anio: ultimoHist.anio, valor: ultimoHist.valor }, ...proyeccion])}
          fill="none"
          stroke={COLOR}
          strokeWidth={2}
          strokeDasharray="4 3"
        />

        {hist.map((p) => (
          <circle key={p.anio} cx={x(p.anio)} cy={y(p.valor)} r={2.5} fill={COLOR} />
        ))}
        {proyeccion.map((p) => (
          <g key={p.anio} tabIndex={0} className="group outline-none">
            <circle cx={x(p.anio)} cy={y(p.valor)} r={3} fill="#fcfcfb" stroke={COLOR} strokeWidth={2} />
            <title>
              {p.anio}: {p.valor.toLocaleString("es-CO")} (entre {p.lo.toLocaleString("es-CO")} y {p.hi.toLocaleString("es-CO")})
            </title>
          </g>
        ))}

        {[minA, ...proyeccion.map((p) => p.anio)].map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="9" fill="#8b8781">
            {a}
          </text>
        ))}
        <text x={x(ultimoHist.anio)} y={H - 8} textAnchor="middle" fontSize="9" fill="#8b8781">
          {ultimoHist.anio}
        </text>
      </svg>
    </div>
  );
}
