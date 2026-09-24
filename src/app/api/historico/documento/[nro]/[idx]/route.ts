import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerResolucionDetalle, descargarArchivoResolucion, sincaConfigurado } from "@/lib/sinca";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nro: string; idx: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a SINCA 1.0." }, { status: 403 });
  }
  if (!sincaConfigurado()) return NextResponse.json({ error: "SINCA 1.0 no está configurado." }, { status: 503 });

  const { nro, idx } = await params;
  const nroSolicitud = parseInt(nro, 10);
  const indice = parseInt(idx, 10);
  if (!Number.isFinite(nroSolicitud) || !Number.isFinite(indice) || indice < 0) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  let ruta: string | null = null;
  try {
    const detalle = await obtenerResolucionDetalle(nroSolicitud);
    ruta = detalle?.emision_documentos?.[indice]?.caminopdf_edc ?? null;
  } catch {
    return NextResponse.json({ error: "No fue posible consultar SINCA 1.0." }, { status: 502 });
  }
  if (!ruta) return NextResponse.json({ error: "Ese documento no tiene archivo registrado." }, { status: 404 });

  const archivo = await descargarArchivoResolucion(ruta);
  if (!archivo.ok) {
    return NextResponse.json({ error: archivo.mensaje }, { status: archivo.estado === 400 ? 404 : 502 });
  }

  return new NextResponse(archivo.datos, {
    status: 200,
    headers: {
      "Content-Type": archivo.contentType,
      "Content-Disposition": `inline; filename="${archivo.nombre}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
