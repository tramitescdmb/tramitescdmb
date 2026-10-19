const ESTILOS: Record<string, { anillo: string }> = {
  RADICADO: { anillo: "border-techblue-500" },
  EN_TRAMITE: { anillo: "border-amber-500" },
  INFORMACION_ADICIONAL_REQUERIDA: { anillo: "border-orange-500" },
  SUSPENDIDO: { anillo: "border-stone-400" },
  APROBADO: { anillo: "border-emerald-500" },
  NEGADO: { anillo: "border-red-500" },
  DESISTIDO: { anillo: "border-stone-400" },
  ARCHIVADO: { anillo: "border-stone-400" },
  RECHAZADO: { anillo: "border-red-500" },
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
  const estilo = ESTILOS[estado] ?? { anillo: "border-stone-400" };
  const etiqueta = ETIQUETAS[estado] ?? estado;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-stone-700">
      <span className={`h-3 w-3 flex-none rounded-full border-2 ${estilo.anillo}`} aria-hidden />
      {etiqueta}
    </span>
  );
}
