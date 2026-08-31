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
  // Cada parte se recorta ANTES de unirse (no después): unir primero y recortar al final solo
  // quita los espacios de las puntas, dejando dobles espacios internos si algún dato ya venía con
  // espacios sueltos alrededor (dato viejo, copiado y pegado, etc.).
  const nombres = s.nombres?.trim();
  const apellidos = s.apellidos?.trim();
  const razonSocial = s.razonSocial?.trim();
  if (s.tipo === "JURIDICA") {
    return razonSocial || [nombres, apellidos].filter(Boolean).join(" ") || "—";
  }
  return [nombres, apellidos].filter(Boolean).join(" ") || razonSocial || "—";
}
