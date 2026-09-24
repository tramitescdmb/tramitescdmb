import { getConfiguracionSitio } from "@/lib/config-sitio";
import { solicitarSelloTiempo } from "@/lib/sello-tiempo";

export type DatosFirmaResueltos = {
  proveedor: string;
  formato: string;
  selloTiempoEn: Date;
  selloTiempoFuente: string;
  selloTiempoToken: string | null;
};

const SELLO_INTERNO = "Bitácora encadenada del SGDEA (SHA-256)";

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

export function etiquetaFormatoFirma(formato: string): string {
  return { "hash-sha256": "Firma electrónica (hash SHA-256)", PAdES: "Firma digital PAdES", CAdES: "Firma digital CAdES" }[formato] ?? formato;
}
