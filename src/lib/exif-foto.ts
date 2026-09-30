export type MetadatosExif = { tomadaEn: Date | null; lat: number | null; lon: number | null };

// La cámara no siempre guarda EXIF (se pierde al comprimir, algunos dispositivos lo omiten por
// privacidad) — todo es best-effort, nunca bloquea la subida de la foto.
export async function leerExifFoto(file: File): Promise<MetadatosExif> {
  try {
    const exifr = (await import("exifr")).default;
    const datos = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
    if (!datos) return { tomadaEn: null, lat: null, lon: null };
    const tomadaEn = datos.DateTimeOriginal ?? datos.CreateDate ?? null;
    return {
      tomadaEn: tomadaEn instanceof Date ? tomadaEn : null,
      lat: typeof datos.latitude === "number" ? datos.latitude : null,
      lon: typeof datos.longitude === "number" ? datos.longitude : null,
    };
  } catch {
    return { tomadaEn: null, lat: null, lon: null };
  }
}
