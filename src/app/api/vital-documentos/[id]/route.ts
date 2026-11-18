import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeConsultarVital } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { abrirDocumentoVital, urlActualAnexoVital, urlArchivoDeRuta } from "@/lib/vital";

/**
 * Abre un anexo de una solicitud de VITAL. Los anexos no se guardan en el NAS:
 * se piden a VITAL en el momento y se entregan directo al navegador.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  const documento = await db.solicitudVitalDocumento.findUnique({
    where: { id },
    include: { solicitud: { select: { idVital: true, expediente: { select: { tramiteTipoId: true } } } } },
  });
  // Quien consulta VITAL, o quien tiene acceso al trámite en el que se convirtió la solicitud.
  const tramiteDelExpediente = documento?.solicitud.expediente?.tramiteTipoId;
  const accesoPorExpediente = Boolean(tramiteDelExpediente && (permisos.esAdmin || permisos.tramites.has(tramiteDelExpediente)));
  if (!puedeConsultarVital(permisos) && !accesoPorExpediente) {
    return NextResponse.json({ error: "No tiene acceso a VITAL." }, { status: 403 });
  }
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const urlArchivo = urlArchivoDeRuta(documento.storagePath);
  if (!urlArchivo) {
    // Registro antiguo con archivo en el almacén (antes de dejar de guardarlos).
    return NextResponse.redirect(await getSignedDownloadUrl(documento.storagePath));
  }

  let r = await abrirDocumentoVital(urlArchivo);
  if (!r.ok) {
    // La dirección pudo cambiar en VITAL: se busca la actual por el nombre.
    const actual = await urlActualAnexoVital(documento.solicitud.idVital, documento.nombre).catch(() => null);
    if (actual && actual !== urlArchivo) {
      r = await abrirDocumentoVital(actual);
      if (r.ok) await db.solicitudVitalDocumento.update({ where: { id }, data: { storagePath: `vital:${actual}` } }).catch(() => {});
    }
  }
  if (!r.ok) {
    console.error(`[VITAL] ${documento.solicitud.idVital}: no se pudo abrir «${documento.nombre}»: ${r.motivo}`);
    return pagina(`No se pudo mostrar el anexo «${documento.nombre}».`);
  }

  const headers = new Headers({
    "Content-Type": r.mimeType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(documento.nombre)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (r.tamano) headers.set("Content-Length", r.tamano);
  return new NextResponse(r.cuerpo, { status: 200, headers });
}

function pagina(mensaje: string) {
  const esc = mensaje.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Anexo de VITAL</title><body style="font-family:sans-serif;padding:2rem;max-width:40rem"><p>${esc}</p><p>Intente de nuevo en unos minutos.</p></body>`,
    { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
