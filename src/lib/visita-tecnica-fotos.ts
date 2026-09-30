const EXTENSIONES_FOTO = ["jpg", "jpeg", "png"] as const;

export const MAX_FOTOS_VISITA = 8;
export const TAMANO_MAXIMO_FOTO_VISITA_MB = 2;
export const TAMANO_MAXIMO_FOTO_VISITA_BYTES = TAMANO_MAXIMO_FOTO_VISITA_MB * 1024 * 1024;

function esExtensionFoto(nombre: string): boolean {
  const idx = nombre.lastIndexOf(".");
  const ext = idx === -1 ? "" : nombre.slice(idx + 1).toLowerCase();
  return (EXTENSIONES_FOTO as readonly string[]).includes(ext);
}

export function mensajeFotoTipoInvalido(nombre: string): string {
  return `"${nombre}" no es una foto válida. Se aceptan JPG y PNG.`;
}

export function mensajeFotoGrande(nombre: string): string {
  return `"${nombre}" pesa más de ${TAMANO_MAXIMO_FOTO_VISITA_MB} MB incluso comprimida. Tome la foto con menor resolución o inténtelo de nuevo.`;
}

export function mensajeDemasiadasFotos(): string {
  return `Máximo ${MAX_FOTOS_VISITA} fotos por visita.`;
}

export function filtrarLoteFotosVisita(nuevas: File[], yaSeleccionadas: number): { validas: File[]; error: string | null } {
  const validas: File[] = [];
  let error: string | null = null;
  let cupo = MAX_FOTOS_VISITA - yaSeleccionadas;
  for (const f of nuevas) {
    if (!esExtensionFoto(f.name) && !f.type.startsWith("image/")) {
      error ??= mensajeFotoTipoInvalido(f.name);
      continue;
    }
    if (cupo <= 0) {
      error ??= mensajeDemasiadasFotos();
      continue;
    }
    validas.push(f);
    cupo--;
  }
  return { validas, error };
}
