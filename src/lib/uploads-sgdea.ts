import { extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

/**
 * Límites de los adjuntos del SGDEA (correspondencia y expedientes documentales),
 * más estrictos que los de Trámites 2.0 (planos y estudios técnicos, hasta 25 MB):
 * un radicado o un documento de archivo debe ser liviano y consultable. Se pueden
 * subir varios, pero pocos y pequeños.
 */
export const MAX_ARCHIVOS_LOTE = 10;
export const TAMANO_MAXIMO_SGDEA_MB = 2;
export const TAMANO_MAXIMO_SGDEA_BYTES = TAMANO_MAXIMO_SGDEA_MB * 1024 * 1024;

export function mensajeArchivoGrandeSGDEA(nombre: string): string {
  return `"${nombre}" pesa más de ${TAMANO_MAXIMO_SGDEA_MB} MB, el máximo por archivo en el SGDEA. Comprímalo o divídalo.`;
}

export function mensajeDemasiadosArchivos(): string {
  return `Máximo ${MAX_ARCHIVOS_LOTE} archivos a la vez. Súbalos en varias tandas si son más.`;
}

/**
 * Valida un lote NUEVO de archivos (cliente) contra las reglas del SGDEA: tipo
 * permitido, tamaño máximo por archivo y tope de archivos en total. Devuelve los
 * que pasan y el primer mensaje de error (se muestra uno a la vez).
 */
export function filtrarLoteSGDEA(nuevos: File[], yaSeleccionados: number): { validos: File[]; error: string | null } {
  const validos: File[] = [];
  let error: string | null = null;
  let cupo = MAX_ARCHIVOS_LOTE - yaSeleccionados;
  for (const f of nuevos) {
    if (!extensionPermitida(f.name)) {
      error ??= mensajeTipoNoPermitido(f.name);
      continue;
    }
    if (f.size > TAMANO_MAXIMO_SGDEA_BYTES) {
      error ??= mensajeArchivoGrandeSGDEA(f.name);
      continue;
    }
    if (cupo <= 0) {
      error ??= mensajeDemasiadosArchivos();
      continue;
    }
    validos.push(f);
    cupo--;
  }
  return { validos, error };
}

/**
 * Defensa en profundidad en el servidor: el navegador ya filtró, pero el cuerpo
 * de la petición se puede fabricar. Rechaza si hay más de `MAX_ARCHIVOS_LOTE` o
 * si algún `tamanoBytes` declarado supera el máximo. Devuelve el mensaje de error
 * o `null` si el lote es válido.
 */
export function validarLoteDocumentosSGDEA(documentos: { nombre?: string; tamanoBytes?: number }[]): string | null {
  if (documentos.length > MAX_ARCHIVOS_LOTE) return mensajeDemasiadosArchivos();
  for (const d of documentos) {
    if ((d.tamanoBytes ?? 0) > TAMANO_MAXIMO_SGDEA_BYTES) return mensajeArchivoGrandeSGDEA(d.nombre ?? "un archivo");
  }
  return null;
}
