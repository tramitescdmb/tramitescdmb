export const MENSAJE_DOCUMENTO_YA_FIRMADO =
  "Este documento ya quedó firmado por todos: no se puede reemplazar su archivo ni borrarlo. Si hay que corregirlo, súbalo como un documento nuevo.";

/** Texto para el historial cuando reemplazar o borrar un documento anula firmas ya hechas. */
export function detalleFirmasAnuladas(nombreDocumento: string, firmantes: string[], motivo: "reemplazo" | "borrado"): string | null {
  if (firmantes.length === 0) return null;
  const quien = firmantes.join(", ");
  return motivo === "reemplazo"
    ? `Al reemplazar el archivo de "${nombreDocumento}" se anularon las firmas de ${quien}; deben volver a firmar.`
    : `Se borró "${nombreDocumento}", que ya tenía firmas de ${quien}.`;
}

export const MENSAJE_NOMBRE_FIRMADO =
  "Este documento ya tiene firmas y su nombre hace parte de lo firmado: no se puede renombrar. Si el nombre está mal, cargue el documento de nuevo con el nombre correcto.";
