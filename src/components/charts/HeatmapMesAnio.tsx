const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type Fila = { anio: number; meses: number[] };

/**
 * Calor año (fila) × mes (columna). Codificación secuencial de un solo tono
 * (azul), opacidad proporcional al valor. Con muchos años se parte en dos
 * bloques lado a lado para no ocupar tanto alto.
 */
export function HeatmapMesAnio({ filas, emptyMessage }: { filas: Fila[]; emptyMessage: string }) {
  if (filas.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...filas.flatMap((f) => f.meses));

  const bloques = filas.length > 16 ? [filas.slice(0, Math.ceil(filas.length / 2)), filas.slice(Math.ceil(filas.length / 2))] : [filas];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {bloques.map((bloque, bi) => (
        <div key={bi} className="overflow-x-auto">
          <table className="border-separate text-[11px]" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th />
                {MESES.map((m, i) => (
                  <th key={i} className="w-6 pb-0.5 text-center font-medium text-stone-400">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloque.map((f) => (
                <tr key={f.anio}>
                  <td className="pr-1.5 text-right tabular-nums text-stone-500">{f.anio}</td>
                  {f.meses.map((v, i) => {
                    const alpha = v === 0 ? 0 : 0.12 + 0.88 * (v / max);
                    return (
                      <td
                        key={i}
                        tabIndex={0}
                        title={`${MESES_LARGO[i]} de ${f.anio}: ${v} ${v === 1 ? "resolución" : "resoluciones"}`}
                        className="h-6 w-6 rounded-sm text-center align-middle text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400"
                        style={{ backgroundColor: v === 0 ? "#f4f2ee" : `rgba(42,120,214,${alpha})`, color: alpha > 0.6 ? "#fff" : "#78716c" }}
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
      ))}
    </div>
  );
}
