const ESTADOS_TERMINALES = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"];
const ESTADOS_EN_PAUSA = ["SUSPENDIDO", "INFORMACION_ADICIONAL_REQUERIDA"];

export function pasosParaAvance(titulos: string[]): number {
  const ultimo = titulos[titulos.length - 1] ?? "";
  return titulos.length > 1 && /seguimiento/i.test(ultimo) ? titulos.length - 1 : titulos.length;
}

const CIERRES_ANTICIPADOS = ["DESISTIDO", "ARCHIVADO", "RECHAZADO"];

/**
 * `finalizado`: el procedimiento terminó (estado final + fecha de cierre, ver tramiteFinalizado).
 * Un trámite aprobado o negado que aún debe notificarse NO está finalizado: su avance sigue
 * contando pasos. Si no se indica, se asume finalizado solo en los cierres anticipados
 * (desistido, archivado, rechazado), que siempre terminan el trámite.
 */
export function calcularAvance(
  pasoActualNumero: number,
  totalPasos: number,
  estado: string,
  pasosAvance = totalPasos,
  finalizado: boolean = CIERRES_ANTICIPADOS.includes(estado)
) {
  const pasoActual = Math.min(Math.max(pasoActualNumero, 1), totalPasos);
  const completados = finalizado ? totalPasos : pasoActual - 1;
  const base = Math.max(1, Math.min(pasosAvance, totalPasos));
  const pct = finalizado ? 100 : Math.min(100, Math.round((completados / base) * 100));
  return { finalizado, pasoActual, completados, pct };
}

const ETIQUETA_ESTADO: Record<string, string> = {
  APROBADO: "Aprobado",
  NEGADO: "Negado",
  DESISTIDO: "Desistido",
  ARCHIVADO: "Archivado",
  RECHAZADO: "Rechazado",
};

export function ProgresoExpediente({
  pasoActualNumero,
  totalPasos,
  pasosAvance,
  estado,
  finalizado,
  tamaño = "chico",
}: {
  pasoActualNumero: number;
  totalPasos: number;
  pasosAvance?: number;
  estado: string;
  finalizado?: boolean;
  tamaño?: "chico" | "grande";
}) {
  if (totalPasos <= 0) return null;

  const terminal = ESTADOS_TERMINALES.includes(estado);
  const enPausa = ESTADOS_EN_PAUSA.includes(estado);
  const { finalizado: fin, pasoActual, completados, pct } = calcularAvance(pasoActualNumero, totalPasos, estado, pasosAvance, finalizado);
  const nombreEstado = ETIQUETA_ESTADO[estado] ?? estado;
  const verde = estado === "APROBADO";
  const rojo = estado === "NEGADO" || estado === "RECHAZADO";

  const paleta = fin
    ? verde
      ? { lleno: "bg-emerald-500", actual: "bg-emerald-500", texto: "text-emerald-700", etiqueta: `Trámite finalizado · ${nombreEstado}` }
      : rojo
        ? { lleno: "bg-red-400", actual: "bg-red-400", texto: "text-red-700", etiqueta: `Trámite finalizado · ${nombreEstado}` }
        : { lleno: "bg-stone-400", actual: "bg-stone-400", texto: "text-stone-600", etiqueta: `Trámite finalizado · ${nombreEstado}` }
    : terminal
      ? verde
        ? { lleno: "bg-emerald-500", actual: "bg-emerald-600 ring-2 ring-emerald-200", texto: "text-emerald-700", etiqueta: `${nombreEstado} · por finalizar (paso ${pasoActual} de ${totalPasos})` }
        : { lleno: "bg-red-400", actual: "bg-red-500 ring-2 ring-red-200", texto: "text-red-700", etiqueta: `${nombreEstado} · por finalizar (paso ${pasoActual} de ${totalPasos})` }
      : enPausa
        ? estado === "SUSPENDIDO"
          ? { lleno: "bg-amber-400", actual: "bg-amber-500 ring-2 ring-amber-200", texto: "text-amber-700", etiqueta: "Suspendido" }
          : { lleno: "bg-orange-400", actual: "bg-orange-500 ring-2 ring-orange-200", texto: "text-orange-700", etiqueta: "Esperando información del solicitante" }
        : { lleno: "bg-cdmb-500", actual: "bg-cdmb-600 ring-2 ring-cdmb-200", texto: "text-stone-700", etiqueta: `Paso ${pasoActual} de ${totalPasos}` };

  const alto = tamaño === "grande" ? "h-2.5" : "h-2";
  const textoTamaño = tamaño === "grande" ? "text-xs" : "text-[11px]";

  return (
    <div
      className="w-full"
      role="img"
      aria-label={`${paleta.etiqueta}. Avance del procedimiento: ${pct}% (${completados} de ${totalPasos} pasos completados).`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`min-w-0 truncate font-medium ${paleta.texto} ${textoTamaño}`}>{paleta.etiqueta}</span>
        <span className={`flex-none font-semibold text-stone-500 ${textoTamaño}`}>{pct}%</span>
      </div>
      <div className={`flex w-full gap-[2px] ${alto}`} aria-hidden>
        {Array.from({ length: totalPasos }, (_, i) => {
          const n = i + 1;
          const esActual = !fin && n === pasoActual;
          const lleno = n <= completados;
          const clase = fin || lleno ? paleta.lleno : esActual ? paleta.actual : "bg-stone-200";
          return (
            <span
              key={n}
              className={`h-full flex-1 rounded-[2px] ${clase} ${esActual ? "z-10" : ""} transition-colors`}
            />
          );
        })}
      </div>
    </div>
  );
}
