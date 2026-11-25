import { redirigirAlmacen } from "@/lib/almacen";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeConsultarVital } from "@/lib/permisos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { abrirDocumentoVital, urlActualAnexoVital, urlArchivoDeRuta, urlVitalPublico } from "@/lib/vital";

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
  if (urlArchivo === null) {
    // Registro antiguo con archivo en el almacén (antes de dejar de guardarlos).
    return redirigirAlmacen(await getSignedDownloadUrl(documento.storagePath));
  }

  // Un anexo que VITAL listó sin dirección: se busca la actual por el nombre.
  let r: Awaited<ReturnType<typeof abrirDocumentoVital>> = urlArchivo
    ? await abrirDocumentoVital(urlArchivo)
    : { ok: false, motivo: "VITAL listó el anexo sin dirección de descarga." };
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
    return pagina(documento.nombre, documento.solicitud.idVital);
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

/**
 * Página breve cuando el anexo no se pudo traer: no explica la falla (eso queda en
 * el registro del servidor) y ofrece abrir la solicitud en el portal de VITAL,
 * donde el anexo se puede ver y descargar.
 */
function pagina(nombre: string, idVital: string) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const enVital = esc(urlVitalPublico(idVital));
  const boton =
    "display:inline-block;padding:.5rem .9rem;border-radius:.4rem;text-decoration:none;font-weight:600";
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anexo de VITAL</title>` +
      `<body style="font-family:system-ui,sans-serif;padding:2rem 1rem;max-width:40rem;margin:auto;color:#1c1917">` +
      `<p>No se pudo abrir el anexo «${esc(nombre)}» desde el SIC.</p>` +
      `<p>Puede verlo y descargarlo en el portal de VITAL, solicitud ${esc(idVital)}.</p>` +
      `<p><a href="${enVital}" target="_blank" rel="noreferrer" style="${boton};background:#15803d;color:#fff">Ver anexos en VITAL</a></p></body>`,
    { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
