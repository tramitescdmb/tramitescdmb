/**
 * Progreso de un envío en curso (subir documentos + radicar/guardar). El
 * porcentaje es real, no animado: sube cuando cada documento termina de
 * subirse y al completar el guardado final — no es una barra "de mentira"
 * que avanza sola mientras se espera.
 */
export function BarraProgresoEnvio({ pct, texto }: { pct: number; texto: string }) {
  return (
    <div className="rounded-lg border border-cdmb-200 bg-cdmb-50/60 px-3 py-2.5" role="status" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-cdmb-800">{texto}</span>
        <span className="flex-none font-semibold text-cdmb-700">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cdmb-100">
        <div className="h-full rounded-full bg-cdmb-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
