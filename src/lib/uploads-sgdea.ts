import { extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

export const MAX_ARCHIVOS_LOTE = 10;
export const TAMANO_MAXIMO_SGDEA_MB = 2;
export const TAMANO_MAXIMO_SGDEA_BYTES = TAMANO_MAXIMO_SGDEA_MB * 1024 * 1024;

export function mensajeArchivoGrandeSGDEA(nombre: string): string {
  return `"${nombre}" pesa más de ${TAMANO_MAXIMO_SGDEA_MB} MB, el máximo por archivo en el SGDEA. Comprímalo o divídalo.`;
}

export function mensajeDemasiadosArchivos(): string {
  return `Máximo ${MAX_ARCHIVOS_LOTE} archivos a la vez. Súbalos en varias tandas si son más.`;
}

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

export function validarLoteDocumentosSGDEA(documentos: { nombre?: string; tamanoBytes?: number }[]): string | null {
  if (documentos.length > MAX_ARCHIVOS_LOTE) return mensajeDemasiadosArchivos();
  for (const d of documentos) {
    if ((d.tamanoBytes ?? 0) > TAMANO_MAXIMO_SGDEA_BYTES) return mensajeArchivoGrandeSGDEA(d.nombre ?? "un archivo");
  }
  return null;
}
