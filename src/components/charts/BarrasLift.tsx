type Item = { label: string; lift: number; casos: number };

// Diverging: por encima de 1,0× (sube) vs por debajo (baja). Dos polos + neutro.
const SUBE = "#1baf7a"; // aqua/verde
const BAJA = "#eb6834"; // naranja

/**
 * Barras divergentes centradas en 1,0× (el promedio). A la derecha, factores que
 * SUBEN la probabilidad; a la izquierda, los que la BAJAN. El largo es la razón
 * de verosimilitud (lift).
 */
export function BarrasLift({ data, emptyMessage }: { data: Item[]; emptyMessage: string }) {
  if (data.length === 0) return <p className="px-1 py-8 text-center text-sm text-stone-400">{emptyMessage}</p>;
  const maxDesv = Math.max(...data.map((d) => Math.abs(Math.log2(d.lift || 1))), 0.1);

  return (
    <ul className="space-y-2">
      {data.map((item) => {
        const l = Math.log2(item.lift || 1); // simétrico: 2× y 0,5× tienen el mismo largo
        const frac = Math.min(1, Math.abs(l) / maxDesv);
        const sube = l >= 0;
        return (
          <li key={item.label} tabIndex={0} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400">
            <div className="min-w-0">
              <p className="mb-0.5 truncate text-xs text-stone-700" title={item.label}>
                {item.label}
              </p>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div className="absolute left-1/2 top-0 h-full w-px bg-stone-300" />
                <div
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    backgroundColor: sube ? SUBE : BAJA,
                    left: sube ? "50%" : `${50 - frac * 50}%`,
                    width: `${frac * 50}%`,
                  }}
                />
              </div>
            </div>
            <span className="flex-none whitespace-nowrap text-xs tabular-nums text-stone-500">
              {item.lift.toFixed(2)}× <span className="text-stone-400">n={item.casos}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
