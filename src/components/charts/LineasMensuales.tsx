type Serie = { nombre: string; color: string };
type Punto = { etiqueta: string; valores: number[] };

const ANCHO = 640;
const ALTO = 180;
const IZQ = 34;
const DER = 24;
const ARR = 12;
const ABA = 26;

function pasoEje(max: number) {
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(Math.max(bruto, 1)));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? potencia * 10;
  return Math.max(paso, 1);
}

export function LineasMensuales({ series, datos, vacio }: { series: Serie[]; datos: Punto[]; vacio: string }) {
  const total = datos.reduce((s, d) => s + d.valores.reduce((a, b) => a + b, 0), 0);
  if (datos.length < 2 || total === 0) return <p className="py-10 text-center text-sm text-stone-400">{vacio}</p>;

  const maxDato = Math.max(...datos.flatMap((d) => d.valores), 1);
  const paso = pasoEje(maxDato);
  const tope = Math.ceil(maxDato / paso) * paso;
  const ancho = ANCHO - IZQ - DER;
  const alto = ALTO - ARR - ABA;
  const x = (i: number) => IZQ + (i / (datos.length - 1)) * ancho;
  const y = (v: number) => ARR + alto - (v / tope) * alto;
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const columna = ancho / (datos.length - 1);

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {series.map((s) => (
          <li key={s.nombre} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.nombre}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" role="img" aria-label={`Evolución mensual: ${series.map((s) => s.nombre).join(" y ")}`}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={IZQ} x2={ANCHO - DER} y1={y(m)} y2={y(m)} stroke={m === 0 ? "#c7cec5" : "#eef1ef"} strokeWidth={1} />
            <text x={IZQ - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fill="#76847a">
              {m.toLocaleString("es-CO")}
            </text>
          </g>
        ))}
        {datos.map((d, i) => (
          <text key={d.etiqueta} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="10" fill="#76847a">
            {d.etiqueta}
          </text>
        ))}
        {series.map((s, si) => (
          <g key={s.nombre}>
            <path
              d={datos.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.valores[si])}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {datos.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d.valores[si])} r={3.5} fill={s.color} stroke="#ffffff" strokeWidth={2} />
            ))}
          </g>
        ))}
        {datos.map((d, i) => {
          const alaDerecha = i < datos.length / 2;
          const cajaX = alaDerecha ? x(i) + 8 : x(i) - 8 - 128;
          return (
            <g key={`h${i}`} className="group">
              <rect x={x(i) - columna / 2} y={ARR} width={columna} height={alto} fill="transparent" />
              <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
                <line x1={x(i)} x2={x(i)} y1={ARR} y2={ARR + alto} stroke="#9aa59d" strokeWidth={1} strokeDasharray="3 3" />
                <rect x={cajaX} y={ARR} width={128} height={18 + series.length * 16} rx={4} fill="#1b2a20" />
                <text x={cajaX + 8} y={ARR + 14} fontSize="11" fontWeight="600" fill="#ffffff">
                  {d.etiqueta}
                </text>
                {series.map((s, si) => (
                  <g key={s.nombre}>
                    <rect x={cajaX + 8} y={ARR + 22 + si * 16} width={8} height={8} rx={1} fill={s.color} />
                    <text x={cajaX + 20} y={ARR + 30 + si * 16} fontSize="11" fill="#ffffff">
                      {s.nombre}: {d.valores[si].toLocaleString("es-CO")}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
