import { db } from "@/lib/db";
import { urlBasePlataforma } from "@/lib/avisos-correo";

/**
 * Dirección de la plataforma que se imprime en los PDF firmados (enlace y QR del validador).
 * Sale de la configuración (o de URL_PLATAFORMA), no del encabezado Host de la petición: así el sello
 * no depende de cómo entró quien lo descarga (IP, otro nombre o un Host manipulado).
 */
export async function basePublica(h: Headers): Promise<string> {
  const c = await db.configuracionSitio.findUnique({ where: { id: "singleton" }, select: { urlPlataforma: true } }).catch(() => null);
  return urlBasePlataforma(c?.urlPlataforma ?? null) ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
}
