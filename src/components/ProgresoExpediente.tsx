const ESTADOS_TERMINALES = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"];
const ESTADOS_EN_PAUSA = ["SUSPENDIDO", "INFORMACION_ADICIONAL_REQUERIDA"];

/**
 * Barra de avance del expediente: cuánto del procedimiento ya se recorrió,
 * como una fila de segmentos (uno por paso del flujo) — así se "ve" en qué
 * punto va sin leer un número. No mide probabilidad de aprobación, mide
 * avance del proceso.
 *
 * Tres situaciones, cada una con su color, para que el estado no quede
 * escondido detrás de "un % que sube":
 *  - En trámite   → segmentos recorridos en verde CDMB, el paso actual resaltado.
 *  - En pausa     → SUSPENDIDO o INFORMACIÓN ADICIONAL REQUERIDA: ámbar/naranja;
 *                   el trámite no está avanzando y eso debe notarse.
 *  - Concluido    → todos los segmentos llenos, del color del desenlace
 *                   (aprobado = verde, negado = rojo, archivado/desistido = gris).
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
  const enPausa = ESTADOS_EN_PAUSA.includes(estado);

  const pasoActual = Math.min(Math.max(pasoActualNumero, 1), totalPasos);
  const completados = terminal ? totalPasos : pasoActual - 1;
  const pct = Math.round((completados / totalPasos) * 100);

  const paleta = terminal
    ? estado === "APROBADO"
      ? { lleno: "bg-emerald-500", actual: "bg-emerald-500", texto: "text-emerald-700", etiqueta: "Trámite aprobado" }
      : estado === "NEGADO" || estado === "RECHAZADO"
        ? { lleno: "bg-red-400", actual: "bg-red-400", texto: "text-red-700", etiqueta: "Trámite negado" }
        : { lleno: "bg-stone-300", actual: "bg-stone-300", texto: "text-stone-500", etiqueta: estado === "DESISTIDO" ? "Trámite desistido" : "Trámite archivado" }
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
      aria-label={`${paleta.etiqueta}. Avance del procedimiento: ${pct}% (${completados} de ${totalPasos} pasos).`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`min-w-0 truncate font-medium ${paleta.texto} ${textoTamaño}`}>{paleta.etiqueta}</span>
        <span className={`flex-none font-semibold text-stone-500 ${textoTamaño}`}>{pct}%</span>
      </div>
      <div className={`flex w-full gap-[2px] ${alto}`} aria-hidden>
        {Array.from({ length: totalPasos }, (_, i) => {
          const n = i + 1;
          const esActual = !terminal && n === pasoActual;
          const lleno = n <= completados;
          const clase = terminal || lleno ? paleta.lleno : esActual ? paleta.actual : "bg-stone-200";
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
