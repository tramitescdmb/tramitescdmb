const ESTILOS: Record<string, string> = {
  RADICADO: "bg-blue-50 text-blue-700 ring-blue-600/20",
  EN_TRAMITE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  INFORMACION_ADICIONAL_REQUERIDA: "bg-orange-50 text-orange-700 ring-orange-600/20",
  SUSPENDIDO: "bg-stone-100 text-stone-600 ring-stone-500/20",
  APROBADO: "bg-green-50 text-green-700 ring-green-600/20",
  NEGADO: "bg-red-50 text-red-700 ring-red-600/20",
  DESISTIDO: "bg-stone-100 text-stone-500 ring-stone-500/20",
  ARCHIVADO: "bg-stone-100 text-stone-500 ring-stone-500/20",
  RECHAZADO: "bg-red-50 text-red-700 ring-red-600/20",
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
  const clase = ESTILOS[estado] ?? "bg-stone-100 text-stone-600 ring-stone-500/20";
  const etiqueta = ETIQUETAS[estado] ?? estado;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${clase}`}>
      {etiqueta}
    </span>
  );
}
