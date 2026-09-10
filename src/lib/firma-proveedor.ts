import { getConfiguracionSitio } from "@/lib/config-sitio";
import { solicitarSelloTiempo } from "@/lib/sello-tiempo";

/**
 * Abstracción del proveedor de firma. Hoy solo existe el proveedor "interno"
 * (firma electrónica con hash SHA-256 — Ley 527/1999, Decreto 1074/2015). El
 * hueco `firmarConCA` queda para enchufar una entidad de certificación digital
 * acreditada (Certicámaras, Andes SCD, GSE…) cuando la CDMB contrate una — eso
 * daría firma DIGITAL (formato PAdES/CAdES) con presunción legal, sin cambiar el
 * resto del flujo.
 */

export type DatosFirmaResueltos = {
  proveedor: string; // "interno" | "ca-<nombre>"
  formato: string; // "hash-sha256" | "PAdES" | "CAdES"
  selloTiempoEn: Date;
  selloTiempoFuente: string; // "Bitácora encadenada del SGDEA (SHA-256)" o la URL de la TSA
  selloTiempoToken: string | null; // token RFC-3161 en base64 si se obtuvo de una TSA
};

const SELLO_INTERNO = "Bitácora encadenada del SGDEA (SHA-256)";

/**
 * Resuelve el sello de tiempo y los metadatos de proveedor de una firma a partir
 * de su hash de contenido. Si hay una TSA RFC-3161 configurada
 * (`ConfiguracionSitio.selloTiempoTsaUrl`), intenta obtener un token verificable;
 * si no responde, degrada al sello interno sin romper la firma.
 */
export async function resolverFirma(hashContenidoHex: string): Promise<DatosFirmaResueltos> {
  const config = await getConfiguracionSitio();
  const tsaUrl = config.selloTiempoTsaUrl?.trim();

  if (tsaUrl) {
    const sello = await solicitarSelloTiempo(hashContenidoHex, tsaUrl);
    if (sello) {
      return {
        proveedor: "interno",
        formato: "hash-sha256",
        selloTiempoEn: sello.tiempo,
        selloTiempoFuente: tsaUrl,
        selloTiempoToken: sello.token,
      };
    }
  }

  return {
    proveedor: "interno",
    formato: "hash-sha256",
    selloTiempoEn: new Date(),
    selloTiempoFuente: SELLO_INTERNO,
    selloTiempoToken: null,
  };
}

/** Etiqueta legible del formato de una firma, para la UI. */
export function etiquetaFormatoFirma(formato: string): string {
  return { "hash-sha256": "Firma electrónica (hash SHA-256)", PAdES: "Firma digital PAdES", CAdES: "Firma digital CAdES" }[formato] ?? formato;
}
