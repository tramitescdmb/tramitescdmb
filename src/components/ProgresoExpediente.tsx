const ESTADOS_TERMINALES = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"];

/**
 * Barra de avance del expediente: qué porcentaje de los pasos del flujo ya se
 * recorrió. No mide probabilidad de aprobación — mide avance del proceso. Un
 * expediente en estado terminal (aprobado, negado, archivado, etc.) se muestra
 * siempre al 100%: el trámite ya se resolvió, sin importar el paso en que haya
 * quedado registrado.
 */
export function ProgresoExpediente({
  pasoActualNumero,
  totalPasos,
  estado,
  tamaño = "chico",
}: {
  pasoActualNumero: number;
  totalPasos: number;
  estado: string;
  tamaño?: "chico" | "grande";
}) {
  if (totalPasos <= 0) return null;

  const terminal = ESTADOS_TERMINALES.includes(estado);
  const pct = terminal ? 100 : Math.min(100, Math.round((pasoActualNumero / totalPasos) * 100));

  const color =
    estado === "APROBADO"
      ? "bg-emerald-500"
      : estado === "NEGADO" || estado === "RECHAZADO"
        ? "bg-red-500"
        : estado === "DESISTIDO" || estado === "ARCHIVADO"
          ? "bg-stone-400"
          : "bg-cdmb-500";

  const alto = tamaño === "grande" ? "h-2.5" : "h-1.5";

  return (
    <div className="w-full" role="img" aria-label={`Avance del trámite: ${pct}%, paso ${pasoActualNumero} de ${totalPasos}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className={`font-medium text-stone-500 ${tamaño === "grande" ? "text-xs" : "text-[11px]"}`}>
          {terminal ? "Trámite concluido" : `Paso ${pasoActualNumero} de ${totalPasos}`}
        </span>
        <span className={`font-semibold text-stone-700 ${tamaño === "grande" ? "text-xs" : "text-[11px]"}`}>{pct}%</span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-stone-100 ${alto}`}>
        <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
