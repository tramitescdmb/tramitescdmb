import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { traerDocumentoVital } from "@/lib/vital";

/**
 * Trae en el momento un anexo de VITAL que no quedó guardado al sincronizar:
 * lo descarga por el puente X-Road (como SINCA), lo deja en el NAS y lo abre.
 * GET /api/vital-documentos/traer?solicitud=<id>&nombre=<nombre_archivo>
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "VITAL_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a VITAL." }, { status: 403 });
  }

  const solicitudId = req.nextUrl.searchParams.get("solicitud") ?? "";
  const nombre = req.nextUrl.searchParams.get("nombre") ?? "";
  if (!solicitudId || !nombre) return NextResponse.json({ error: "Faltan datos del anexo." }, { status: 400 });

  try {
    const r = await traerDocumentoVital(solicitudId, nombre);
    if (!r.ok) return pagina(`No se pudo traer el anexo desde VITAL. ${r.motivo}`, 502);
    return NextResponse.redirect(await getSignedDownloadUrl(r.registro.storagePath));
  } catch (err) {
    return pagina(`No se pudo traer el anexo desde VITAL. ${err instanceof Error ? err.message : ""}`, 502);
  }
}

function pagina(mensaje: string, status: number) {
  const esc = mensaje.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Anexo de VITAL</title><body style="font-family:sans-serif;padding:2rem;max-width:40rem"><p>${esc}</p><p>Intente de nuevo en unos minutos. Si persiste, avise a tecnologia@cdmb.gov.co.</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
