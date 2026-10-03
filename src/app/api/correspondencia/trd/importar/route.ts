import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ETIQUETA_CACHE_CATALOGO_TRD } from "@/lib/trd-clasificacion";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { parsearCsvTrd, parsearXmlTrd, importarTrd } from "@/lib/trd-import";
import { parsearXlsxTrd } from "@/lib/trd-import-xlsx";
import { registrarAuditoria } from "@/lib/auditoria";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para importar la TRD.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const archivo = form.get("archivo");
  const modoRaw = String(form.get("modo") || "vigente");
  const modo = modoRaw === "historica" ? "historica" : "vigente";
  const version = String(form.get("version") || "").trim();
  const sincronizar = form.get("sincronizar") === "on";

  if (!(archivo instanceof File) || archivo.size === 0) {
    volver.searchParams.set("error", "Seleccione un archivo Excel, CSV o XML para importar.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const nombreArchivo = archivo.name.toLowerCase();
  const esXml = nombreArchivo.endsWith(".xml");
  const esXlsx = nombreArchivo.endsWith(".xlsx");
  if (!version) {
    volver.searchParams.set("error", "Indique un identificador de versión para esta TRD (ej. 2026-1, o el año de aprobación).");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (archivo.size > 15 * 1024 * 1024) {
    volver.searchParams.set("error", "El archivo es demasiado grande (máximo 15 MB).");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { filas, errores: erroresParseo } = esXlsx
    ? await parsearXlsxTrd(await archivo.arrayBuffer())
    : esXml
      ? parsearXmlTrd(await archivo.text())
      : parsearCsvTrd(await archivo.text());
  if (erroresParseo.length > 0 && filas.length === 0) {
    volver.searchParams.set("error", `No se pudo leer el archivo: ${erroresParseo[0]}`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (filas.length === 0) {
    volver.searchParams.set("error", "El archivo no tiene filas de datos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    const resultado = await importarTrd(filas, { modo, version, sincronizar });
    const descripcion = `${session.nombre} importó una TRD ${modo === "vigente" ? "vigente" : "histórica"} (versión "${version}", archivo "${archivo.name}"${sincronizar ? ", sincronizando" : ""}): ${resultado.filasProcesadas} filas, ${resultado.dependenciasCreadas} dependencias nuevas, ${resultado.seriesCreadas} series nuevas, ${resultado.seriesActualizadas} series actualizadas, ${resultado.subseriesCreadas} subseries nuevas, ${resultado.subseriesActualizadas} actualizadas, ${resultado.subseriesSinCambios} sin cambios, ${resultado.subseriesEliminadas} subseries eliminadas (${resultado.subseriesReclasificadas} con sus registros pasados a la subserie de reemplazo), ${resultado.seriesEliminadas} series eliminadas, ${resultado.subseriesDesactivadas} subseries y ${resultado.seriesDesactivadas} series inactivas por tener registros sin reemplazo.`;
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion, usuarioId: session.userId });
    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "SerieDocumental",
      entidadId: `trd-import-${version}`,
      accion: "CREA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: descripcion,
    });
    const resumen = `Importación lista: ${resultado.filasProcesadas} filas · ${resultado.seriesCreadas} series y ${resultado.subseriesCreadas} subseries nuevas · ${resultado.subseriesActualizadas} subseries actualizadas · ${resultado.subseriesSinCambios} sin cambios${sincronizar ? ` · ${resultado.subseriesEliminadas} subseries y ${resultado.seriesEliminadas} series eliminadas por no venir en el archivo` : ""}${resultado.errores.length ? ` · ${resultado.errores.length} aviso(s), vea abajo` : ""}.`;
    if (resultado.errores.length > 0) {
      console.warn("Errores en importación de TRD:", resultado.errores);
      const MOSTRAR = 8;
      const avisos = resultado.errores.slice(0, MOSTRAR).join(" | ");
      const resto = resultado.errores.length - MOSTRAR;
      volver.searchParams.set("avisos", resto > 0 ? `${avisos} | …y ${resto} aviso(s) más (vea el log del servidor).` : avisos);
    }
    volver.searchParams.set("ok", resumen);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? `No se pudo importar: ${err.message}` : "No se pudo importar la TRD.");
  }
  revalidateTag(ETIQUETA_CACHE_CATALOGO_TRD);
  return NextResponse.redirect(volver, { status: 303 });
}
