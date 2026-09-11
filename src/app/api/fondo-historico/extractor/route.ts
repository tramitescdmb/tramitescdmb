import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fondoHistoricoConfigurado } from "@/lib/fondo-historico";

/**
 * Sirve el script de extracción del Fondo histórico para que un equipo de la
 * red CDMB lo baje con `curl` (no hay git ni pscp cómodo hacia el servidor
 * Oracle). El script no contiene secretos — el token y la URL se pasan por
 * variables de entorno al correrlo.
 *
 *   curl -H "Authorization: Bearer $FONDO_INGEST_TOKEN" \
 *        https://tramitescdmb.vercel.app/api/fondo-historico/extractor?f=psdocuments \
 *        -o extraer-psdocuments.sh
 */
export const runtime = "nodejs";

const ARCHIVOS: Record<string, string> = {
  psdocuments: "extraer-psdocuments.sh",
  "sic-pqr": "extraer-sic.sh",
  "sic-salida": "extraer-sic-salida.sh",
  verdoc: "verdoc.cgi",
};

export async function GET(req: NextRequest) {
  const token = process.env.FONDO_INGEST_TOKEN?.trim();
  if (!fondoHistoricoConfigurado() || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const f = req.nextUrl.searchParams.get("f") ?? "psdocuments";
  const nombre = ARCHIVOS[f];
  if (!nombre) return NextResponse.json({ error: `Extractor desconocido: ${f}` }, { status: 404 });

  try {
    const contenido = await readFile(join(process.cwd(), "scripts", "fondo-historico", nombre), "utf8");
    return new NextResponse(contenido.replace(/\r\n/g, "\n"), {
      headers: {
        "Content-Type": "text/x-shellscript; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el script." }, { status: 500 });
  }
}
