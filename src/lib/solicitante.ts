/**
 * Nombre para mostrar de un Solicitante — persona natural usa nombres+apellidos (separados para
 * poder buscar por cualquiera de los dos, ver /solicitantes), persona jurídica usa razón social.
 */
export function nombreCompletoSolicitante(s: {
  tipo: string;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
}): string {
  if (s.tipo === "JURIDICA") {
    return s.razonSocial?.trim() || [s.nombres, s.apellidos].filter(Boolean).join(" ").trim() || "—";
  }
  return [s.nombres, s.apellidos].filter(Boolean).join(" ").trim() || s.razonSocial?.trim() || "—";
}
