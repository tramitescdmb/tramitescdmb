type Item = { label: string; valor: number };

const COLOR = "#2a78d6";

/**
 * Mini gráfico de columnas compacto (una fila), pensado para 8–14 categorías
 * ordinales cortas. Marca opcional de línea de referencia (p. ej. el promedio
 * = 1,0 en un índice estacional).
 */
export function MiniColumnas({
  data,
  referencia,
  formato = (v: number) => v.toLocaleString("es-CO"),
}: {
  data: Item[];
  referencia?: number;
  formato?: (v: number) => string;
}) {
  if (data.length === 0) return <p className="px-1 py-6 text-center text-sm text-stone-400">—</p>;
  const max = Math.max(...data.map((d) => d.valor), referencia ?? 0) * 1.05;
  const refPct = referencia ? (referencia / max) * 100 : null;

  return (
    <div className="relative flex items-end gap-1.5" style={{ height: 88 }}>
      {refPct != null && (
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-stone-300" style={{ bottom: `calc(${refPct}% + 16px)` }} />
      )}
      {data.map((d) => {
        const h = Math.max((d.valor / max) * 100, 2);
        return (
          <div key={d.label} tabIndex={0} className="group flex flex-1 flex-col items-center outline-none" title={`${d.label}: ${formato(d.valor)}`}>
            <span className="mb-0.5 text-[9px] tabular-nums text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {formato(d.valor)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div className="w-full rounded-sm transition-[filter] group-hover:brightness-110" style={{ height: `${h}%`, backgroundColor: COLOR }} />
            </div>
            <span className="mt-1 text-[10px] text-stone-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
