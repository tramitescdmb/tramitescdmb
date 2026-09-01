const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Calor año (fila) × mes (columna). Codificación secuencial de un solo tono
 * (azul), opacidad proporcional al valor. Revela estacionalidad y años atípicos.
 */
export function HeatmapMesAnio({
  filas,
  emptyMessage,
}: {
  filas: { anio: number; meses: number[] }[];
  emptyMessage: string;
}) {
  if (filas.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...filas.flatMap((f) => f.meses));

  return (
    <div className="overflow-x-auto">
      <table className="border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {MESES.map((m, i) => (
              <th key={i} className="w-7 pb-1 text-center font-medium text-stone-400">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.anio}>
              <td className="pr-2 text-right tabular-nums text-stone-500">{f.anio}</td>
              {f.meses.map((v, i) => {
                const alpha = v === 0 ? 0 : 0.12 + 0.88 * (v / max);
                return (
                  <td
                    key={i}
                    tabIndex={0}
                    title={`${MESES_LARGO[i]} de ${f.anio}: ${v} ${v === 1 ? "resolución" : "resoluciones"}`}
                    className="h-7 w-7 rounded-sm text-center align-middle outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400"
                    style={{ backgroundColor: v === 0 ? "#f4f2ee" : `rgba(42,120,214,${alpha})`, color: alpha > 0.6 ? "#fff" : "#57534e" }}
                  >
                    {v > 0 ? v : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
