/**
 * Insignia de estado del expediente. El color va acompañado siempre de la
 * etiqueta de texto y de un punto — el estado nunca se comunica solo por
 * color (accesibilidad: daltonismo, impresión en blanco y negro).
 */
const ESTILOS: Record<string, { chip: string; punto: string }> = {
  RADICADO: { chip: "bg-blue-50 text-blue-700 ring-blue-600/20", punto: "bg-blue-500" },
  EN_TRAMITE: { chip: "bg-amber-50 text-amber-800 ring-amber-600/20", punto: "bg-amber-500" },
  INFORMACION_ADICIONAL_REQUERIDA: { chip: "bg-orange-50 text-orange-800 ring-orange-600/20", punto: "bg-orange-500" },
  SUSPENDIDO: { chip: "bg-stone-100 text-stone-600 ring-stone-500/20", punto: "bg-stone-400" },
  APROBADO: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", punto: "bg-emerald-500" },
  NEGADO: { chip: "bg-red-50 text-red-700 ring-red-600/20", punto: "bg-red-500" },
  DESISTIDO: { chip: "bg-stone-100 text-stone-500 ring-stone-500/20", punto: "bg-stone-400" },
  ARCHIVADO: { chip: "bg-stone-100 text-stone-500 ring-stone-500/20", punto: "bg-stone-400" },
  RECHAZADO: { chip: "bg-red-50 text-red-700 ring-red-600/20", punto: "bg-red-500" },
};

const ETIQUETAS: Record<string, string> = {
  RADICADO: "Radicado",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida",
  SUSPENDIDO: "Suspendido",
  APROBADO: "Aprobado",
  NEGADO: "Negado",
  DESISTIDO: "Desistido",
  ARCHIVADO: "Archivado",
  RECHAZADO: "Rechazado",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const estilo = ESTILOS[estado] ?? { chip: "bg-stone-100 text-stone-600 ring-stone-500/20", punto: "bg-stone-400" };
  const etiqueta = ETIQUETAS[estado] ?? estado;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${estilo.chip}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${estilo.punto}`} aria-hidden />
      {etiqueta}
    </span>
  );
}
