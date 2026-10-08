import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerResolucionDetalle, descargarArchivoResolucion, sincaConfigurado } from "@/lib/sinca";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export const maxDuration = 60;

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function aviso(estado: number, titulo: string, detalle: string, notaAdmin?: string | null) {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Documento no disponible — SINCA 1.0</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f4;font-family:"Work Sans",system-ui,sans-serif;color:#1c1917;padding:16px;box-sizing:border-box}
main{max-width:460px;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:16px;margin:0 0 8px}p{font-size:14px;line-height:1.5;color:#57534e;margin:0 0 12px}
.nota{background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:8px;padding:10px 12px;font-size:13px}
button{margin-top:4px;background:#038F67;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer}
</style></head><body><main>
<h1>${escapar(titulo)}</h1>
<p>${escapar(detalle)}</p>
${notaAdmin ? `<p class="nota">${escapar(notaAdmin)}</p>` : ""}
<button type="button" onclick="window.close()">Cerrar</button>
</main></body></html>`;
  return new NextResponse(html, { status: estado, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nro: string; idx: string }> }) {
  const session = await getSession();
  if (!session) return aviso(401, "Sesión no válida", "Inicie sesión nuevamente para consultar el documento.");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) {
    return aviso(403, "Acceso no autorizado", "No tiene acceso a la consulta de SINCA 1.0.");
  }
  if (!sincaConfigurado()) return aviso(503, "SINCA 1.0 no está configurado", "La conexión con SINCA 1.0 no está habilitada.");

  const { nro, idx } = await params;
  const nroSolicitud = parseInt(nro, 10);
  const indice = parseInt(idx, 10);
  if (!Number.isFinite(nroSolicitud) || !Number.isFinite(indice) || indice < 0) {
    return aviso(400, "Solicitud inválida", "El enlace del documento no es válido.");
  }

  let ruta: string | null = null;
  try {
    const detalle = await obtenerResolucionDetalle(nroSolicitud);
    ruta = detalle?.emision_documentos?.[indice]?.caminopdf_edc ?? null;
  } catch {
    return aviso(502, "SINCA 1.0 no respondió", "No fue posible consultar SINCA 1.0. Intente nuevamente en unos minutos.");
  }
  if (!ruta) return aviso(404, "Documento sin archivo", "Este documento no tiene un archivo registrado en SINCA 1.0.");

  const archivo = await descargarArchivoResolucion(ruta);
  if (!archivo.ok) {
    if (archivo.estado === 400) {
      return aviso(
        404,
        "Archivo no disponible",
        `SINCA 1.0 no encontró el archivo de la solicitud ${nroSolicitud} en su repositorio de documentos.`,
        permisos.esAdmin
          ? "Si ocurre con todas las resoluciones, verifique que la unidad de red N: esté montada en el servidor 192.168.7.90."
          : null
      );
    }
    return aviso(502, "SINCA 1.0 no respondió", "No fue posible obtener el archivo desde SINCA 1.0. Intente nuevamente en unos minutos.");
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
