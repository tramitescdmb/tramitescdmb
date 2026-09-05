const PASOS = ["Radicada", "Distribuida", "En trámite", "Respondida / archivada"];
const TOTAL_PASOS = PASOS.length;

const PASO_POR_ESTADO: Record<string, number> = {
  RADICADA: 1,
  EN_REPARTO: 2,
  ASIGNADA: 2,
  EN_TRAMITE: 3,
  INFORMACION_ADICIONAL_REQUERIDA: 3,
  RESPONDIDA: 4,
  ARCHIVADA: 4,
};

const EXPLICACION_POR_ESTADO: Record<string, string> = {
  RADICADA: "Se recibió y quedó con número de radicado. Todavía no se ha distribuido a ningún área.",
  EN_REPARTO: "Está pendiente de asignarse a una dependencia o funcionario.",
  ASIGNADA: "Ya se asignó a una dependencia o funcionario para que la atienda.",
  EN_TRAMITE: "Un funcionario la está gestionando.",
  INFORMACION_ADICIONAL_REQUERIDA: "En pausa: se le pidió información adicional al peticionario. El plazo de respuesta también está en pausa hasta que la envíe.",
  RESPONDIDA: "Ya se le dio respuesta al peticionario.",
  ARCHIVADA: "Quedó guardada dentro de un expediente.",
  ANULADA: "Se anuló: no continúa el trámite.",
};

/**
 * Barra de avance de una comunicación (recibida/enviada/interna), en el mismo
 * estilo que ProgresoExpediente: una fila de segmentos, uno por etapa, para
 * que un funcionario no técnico vea de un vistazo en qué punto va sin tener
 * que interpretar el nombre técnico del estado.
 */
export function ProgresoCorrespondencia({
  estado,
  tamaño = "chico",
}: {
  estado: string;
  tamaño?: "chico" | "grande";
}) {
  const anulada = estado === "ANULADA";
  const enPausa = estado === "INFORMACION_ADICIONAL_REQUERIDA";
  const terminal = estado === "RESPONDIDA" || estado === "ARCHIVADA";

  const pasoActual = Math.min(PASO_POR_ESTADO[estado] ?? 1, TOTAL_PASOS);
  const completados = terminal || anulada ? TOTAL_PASOS : pasoActual - 1;
  const pct = Math.round((completados / TOTAL_PASOS) * 100);

  const paleta = anulada
    ? { lleno: "bg-stone-300", actual: "bg-stone-300", texto: "text-stone-500", etiqueta: "Anulada" }
    : terminal
      ? { lleno: "bg-emerald-500", actual: "bg-emerald-500", texto: "text-emerald-700", etiqueta: estado === "RESPONDIDA" ? "Respondida" : "Archivada" }
      : enPausa
        ? { lleno: "bg-orange-400", actual: "bg-orange-500 ring-2 ring-orange-200", texto: "text-orange-700", etiqueta: "Esperando información adicional" }
        : { lleno: "bg-cdmb-500", actual: "bg-cdmb-600 ring-2 ring-cdmb-200", texto: "text-stone-700", etiqueta: PASOS[pasoActual - 1] };

  const alto = tamaño === "grande" ? "h-2.5" : "h-2";
  const textoTamaño = tamaño === "grande" ? "text-xs" : "text-[11px]";
  const explicacion = EXPLICACION_POR_ESTADO[estado];

  return (
    <div className="w-full" role="img" aria-label={`${paleta.etiqueta}. Avance: ${pct}% (${completados} de ${TOTAL_PASOS} etapas).`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`min-w-0 truncate font-medium ${paleta.texto} ${textoTamaño}`}>{paleta.etiqueta}</span>
        <span className={`flex-none font-semibold text-stone-500 ${textoTamaño}`}>{pct}%</span>
      </div>
      <div className={`flex w-full gap-[2px] ${alto}`} aria-hidden>
        {Array.from({ length: TOTAL_PASOS }, (_, i) => {
          const n = i + 1;
          const esActual = !terminal && !anulada && n === pasoActual;
          const lleno = n <= completados;
          const clase = terminal || anulada || lleno ? paleta.lleno : esActual ? paleta.actual : "bg-stone-200";
          return <span key={n} className={`h-full flex-1 rounded-[2px] ${clase} ${esActual ? "z-10" : ""} transition-colors`} />;
        })}
      </div>
      {tamaño === "grande" && explicacion && <p className="mt-1.5 text-xs text-stone-500">{explicacion}</p>}
    </div>
  );
}
