const EVENTOS: Record<string, { icono: string; etiqueta: string }> = {
  CREACION: { icono: "🆕", etiqueta: "Creación del expediente" },
  CAMBIO_ESTADO: { icono: "🔄", etiqueta: "Cambio de estado" },
  AVANCE_PASO: { icono: "➡️", etiqueta: "Avance de paso" },
  DOCUMENTO_SUBIDO: { icono: "📎", etiqueta: "Documento adjuntado" },
  COMENTARIO: { icono: "💬", etiqueta: "Comentario" },
};

export function EventoIcono({ tipo }: { tipo: string }) {
  const info = EVENTOS[tipo] ?? { icono: "•", etiqueta: tipo };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
      <span aria-hidden>{info.icono}</span>
      {info.etiqueta}
    </span>
  );
}
