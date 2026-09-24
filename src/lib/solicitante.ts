export function nombreCompletoSolicitante(s: {
  tipo: string;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
}): string {
  const nombres = s.nombres?.trim();
  const apellidos = s.apellidos?.trim();
  const razonSocial = s.razonSocial?.trim();
  if (s.tipo === "JURIDICA") {
    return razonSocial || [nombres, apellidos].filter(Boolean).join(" ") || "—";
  }
  return [nombres, apellidos].filter(Boolean).join(" ") || razonSocial || "—";
}
