import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { COLUMNAS_TRD_CSV, formatearXmlTrd } from "@/lib/trd-import";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import type { DisposicionFinal } from "@prisma/client";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

const MARCA: Record<DisposicionFinal, "disposicion_ct" | "disposicion_e" | "disposicion_md" | "disposicion_s"> = {
  CONSERVACION_TOTAL: "disposicion_ct",
  ELIMINACION: "disposicion_e",
  MICROFILMACION_DIGITALIZACION: "disposicion_md",
  SELECCION: "disposicion_s",
};

/** Exporta la TRD completa en el MISMO formato que el importador (MoReq 1.7: "formato abierto y editable"). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para administrar el archivo." }, { status: 403 });
  }

  const series = await db.serieDocumental.findMany({
    where: { vigenteHasta: null },
    orderBy: [{ codigo: "asc" }],
    include: {
      dependencia: { select: { codigo: true, nombre: true } },
      subseries: { where: { activo: true }, orderBy: { codigo: "asc" }, include: { tiposDocumentales: { select: { nombre: true } } } },
    },
  });

  const filaObjetos: Record<(typeof COLUMNAS_TRD_CSV)[number], string>[] = [];
  for (const s of series) {
    for (const ss of s.subseries) {
      const marcas: Record<string, string> = { disposicion_ct: "", disposicion_e: "", disposicion_md: "", disposicion_s: "" };
      for (const d of ss.disposicionesFinal) marcas[MARCA[d]] = "X";
      filaObjetos.push({
        dependencia_codigo: s.dependencia?.codigo ?? "",
        dependencia_nombre: s.dependencia?.nombre ?? "",
        serie_codigo: s.codigo,
        serie_nombre: s.nombre,
        serie_descripcion: s.descripcion ?? "",
        subserie_codigo: ss.codigo,
        subserie_nombre: ss.nombre,
        retencion_gestion: String(ss.retencionGestionAnios),
        retencion_central: String(ss.retencionCentralAnios),
        disposicion_ct: marcas.disposicion_ct,
        disposicion_e: marcas.disposicion_e,
        disposicion_md: marcas.disposicion_md,
        disposicion_s: marcas.disposicion_s,
        procedimiento: ss.procedimiento ?? "",
        tipos_documentales: ss.tiposDocumentales.map((t) => t.nombre).join("|"),
      });
    }
  }

  const formato = req.nextUrl.searchParams.get("formato") === "xml" ? "xml" : "csv";

  // No debe impedir la descarga si la bitácora tiene un hipo transitorio de conexión
  // (ya pasó en pruebas: un P2028 aquí no debería convertir un export ya armado en un 500).
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "SerieDocumental",
    entidadId: "trd-completa",
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó la TRD vigente completa (${series.length} series, ${filaObjetos.length} subseries) a ${formato.toUpperCase()}`,
  }).catch((err) => { console.error("No se pudo registrar en la bitácora la exportación de la TRD:", err); });

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  if (formato === "xml") {
    return new NextResponse(formatearXmlTrd(filaObjetos), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="trd-${fechaArchivo}.xml"`,
      },
    });
  }

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [COLUMNAS_TRD_CSV.map(celda).join(";"), ...filaObjetos.map((fila) => COLUMNAS_TRD_CSV.map((c) => celda(fila[c])).join(";"))].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trd-${fechaArchivo}.csv"`,
    },
  });
}
