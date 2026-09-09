"use client";

import { useState } from "react";

/**
 * Área apilada de 2–3 series por mes (Recibidas / Enviadas / Memorandos).
 * Paleta categórica validada con la skill `dataviz` (modo claro, superficie
 * blanca): #1c7a45 / #2563eb / #d97706 — ΔE de daltonismo 8.8, sobre el piso,
 * con leyenda + etiquetas directas SIEMPRE como segundo canal de identidad.
 * Sin librería: SVG puro, misma línea que el resto de src/components/charts.
 */

type Punto = { label: string; RECIBIDA: number; ENVIADA: number; INTERNA: number };
type SerieKey = "RECIBIDA" | "ENVIADA" | "INTERNA";

const SERIES: { key: SerieKey; etiqueta: string; color: string }[] = [
  { key: "RECIBIDA", etiqueta: "Recibidas", color: "#1c7a45" },
  { key: "ENVIADA", etiqueta: "Enviadas", color: "#2563eb" },
  { key: "INTERNA", etiqueta: "Memorandos", color: "#d97706" },
];

const W = 640;
const H = 220;
const PAD = { top: 14, right: 44, bottom: 26, left: 30 };

export function EvolucionPorTipo({ data, emptyMessage }: { data: Punto[]; emptyMessage: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const totalGlobal = data.reduce((acc, d) => acc + d.RECIBIDA + d.ENVIADA + d.INTERNA, 0);
  if (data.length < 2 || totalGlobal === 0) {
    return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxApilado = Math.max(...data.map((d) => d.RECIBIDA + d.ENVIADA + d.INTERNA), 1);
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxApilado) * innerH;

  // Bandas acumuladas para el apilado.
  const bandas = SERIES.map((s, si) => {
    const below = SERIES.slice(0, si);
    return data.map((d, i) => {
      const base = below.reduce((acc, b) => acc + d[b.key], 0);
      return { i, y0: base, y1: base + d[s.key] };
    });
  });

  const areaPath = (banda: { i: number; y0: number; y1: number }[]) => {
    const top = banda.map((p) => `${p.i === 0 ? "M" : "L"} ${x(p.i)} ${y(p.y1)}`).join(" ");
    const bottom = [...banda].reverse().map((p) => `L ${x(p.i)} ${y(p.y0)}`).join(" ");
    return `${top} ${bottom} Z`;
  };
  const linePath = (banda: { i: number; y1: number }[]) =>
    banda.map((p) => `${p.i === 0 ? "M" : "L"} ${x(p.i)} ${y(p.y1)}`).join(" ");

  const ticks = 3;
  const puntoHover = hover != null ? data[hover] : null;

  return (
    <div>
      {/* Leyenda — siempre presente para ≥2 series */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.etiqueta}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Evolución mensual de radicados activos por tipo"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid + eje Y */}
        {Array.from({ length: ticks + 1 }, (_, t) => {
          const v = (maxApilado / ticks) * t;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#ececea" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#a8a29e">
                {Math.round(v).toLocaleString("es-CO")}
              </text>
            </g>
          );
        })}

        {/* Áreas apiladas (2px de aire entre bandas vía stroke de superficie) */}
        {bandas.map((banda, si) => (
          <g key={SERIES[si].key}>
            <path d={areaPath(banda)} fill={SERIES[si].color} opacity={0.85} />
            <path d={linePath(banda)} fill="none" stroke="#fcfcfb" strokeWidth={2} />
          </g>
        ))}

        {/* Eje X */}
        {data.map((d, i) => (
          <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#898781">
            {d.label}
          </text>
        ))}

        {/* Capa de hover: franja + crosshair */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - innerW / (data.length - 1) / 2}
            y={PAD.top}
            width={innerW / (data.length - 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hover != null && (
          <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + innerH} stroke="#57534e" strokeWidth={1} strokeDasharray="3 3" />
        )}

        {/* Etiquetas directas del último mes, fuera del área (≤4 series → direct-labeled) */}
        {bandas.map((banda, si) => {
          const last = banda[banda.length - 1]!;
          const val = data[data.length - 1][SERIES[si].key];
          if (val === 0) return null;
          return (
            <g key={SERIES[si].key}>
              <line
                x1={W - PAD.right}
                y1={y((last.y0 + last.y1) / 2)}
                x2={W - PAD.right + 6}
                y2={y((last.y0 + last.y1) / 2)}
                stroke={SERIES[si].color}
                strokeWidth={2}
              />
              <text
                x={W - PAD.right + 9}
                y={y((last.y0 + last.y1) / 2) + 3}
                fontSize="10"
                fontWeight="600"
                fill={SERIES[si].color}
              >
                {val.toLocaleString("es-CO")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip HTML bajo el gráfico (evita recortes del SVG) */}
      <div className="mt-1 min-h-[1.25rem] text-center text-xs text-stone-500">
        {puntoHover ? (
          <span>
            <strong className="text-stone-700">{puntoHover.label}</strong> ·{" "}
            {SERIES.filter((s) => puntoHover[s.key] > 0)
              .map((s) => `${s.etiqueta} ${puntoHover[s.key].toLocaleString("es-CO")}`)
              .join(" · ") || "sin radicados"}
          </span>
        ) : (
          <span className="text-stone-400">Pase el cursor sobre un mes para ver el detalle</span>
        )}
      </div>
    </div>
  );
}
