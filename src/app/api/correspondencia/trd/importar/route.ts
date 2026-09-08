import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { parsearCsvTrd, parsearXmlTrd, importarTrd } from "@/lib/trd-import";
import { registrarAuditoria } from "@/lib/auditoria";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/**
 * Importa una TRD completa desde un archivo CSV (plantilla propia del sistema).
 * "vigente" reemplaza la versión activa de cada serie que toque (sin borrar la
 * anterior); "historica" carga una TRD antigua ya cerrada, solo para poder
 * reclasificar/migrar información vieja sin tocar la TRD vigente.
 */
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

  if (!(archivo instanceof File) || archivo.size === 0) {
    volver.searchParams.set("error", "Seleccione un archivo CSV o XML para importar.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const esXml = archivo.name.toLowerCase().endsWith(".xml");
  if (!version) {
    volver.searchParams.set("error", "Indique un identificador de versión para esta TRD (ej. 2026-1, o el año de aprobación).");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (archivo.size > 15 * 1024 * 1024) {
    volver.searchParams.set("error", "El archivo es demasiado grande (máximo 15 MB).");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const contenido = await archivo.text();
  const { filas, errores: erroresParseo } = esXml ? parsearXmlTrd(contenido) : parsearCsvTrd(contenido);
  if (erroresParseo.length > 0 && filas.length === 0) {
    volver.searchParams.set("error", `No se pudo leer el archivo: ${erroresParseo[0]}`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (filas.length === 0) {
    volver.searchParams.set("error", "El archivo no tiene filas de datos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    const resultado = await importarTrd(filas, { modo, version });
    const descripcion = `${session.nombre} importó una TRD ${modo === "vigente" ? "vigente" : "histórica"} (versión "${version}"): ${resultado.filasProcesadas} filas, ${resultado.dependenciasCreadas} dependencias nuevas, ${resultado.seriesCreadas} series nuevas, ${resultado.subseriesCreadas} subseries nuevas, ${resultado.subseriesActualizadas} actualizadas.`;
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
    const resumen = `Importación lista: ${resultado.filasProcesadas} filas · ${resultado.seriesCreadas} series y ${resultado.subseriesCreadas} subseries nuevas · ${resultado.subseriesActualizadas} actualizadas${resultado.errores.length ? ` · ${resultado.errores.length} filas con problemas (revise el log del servidor)` : ""}.`;
    if (resultado.errores.length > 0) {
      console.warn("Errores en importación de TRD:", resultado.errores);
    }
    volver.searchParams.set("ok", resumen);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? `No se pudo importar: ${err.message}` : "No se pudo importar la TRD.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
