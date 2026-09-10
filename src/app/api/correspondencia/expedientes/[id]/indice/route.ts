import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { calcularHashIndice } from "@/lib/expedientes-documentales";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function escaparXml(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Exporta el índice electrónico de un expediente documental a CSV o XML (MoReq 1.23/1.47/1.51). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a correspondencia." }, { status: 403 });
  }

  const expediente = await db.expedienteDocumental.findUnique({
    where: { id },
    include: {
      dependencia: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      documentos: { where: { retiradoEn: null }, orderBy: { ordenIndice: "asc" }, include: { subidoPor: { select: { nombre: true } } } },
    },
  });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });

  // MoReq 2.14: hash de verificación de integridad calculado sobre el estado ACTUAL del índice
  // (orden + nombre + huella de cada documento). Siempre presente en la exportación — no solo cuando
  // el expediente está cerrado — para que el sistema que reciba el archivo pueda cotejarlo.
  const hashVerificacion = calcularHashIndice(expediente.documentos);

  // Rango de folios acumulado (MoReq 1.19/1.51) sobre el orden real del índice (ordenIndice, ya viene
  // ordenado así por la consulta), a partir del número de folios que declaró quien subió cada documento.
  let folioAcumulado = 0;
  const folios = expediente.documentos.map((d) => {
    const desde = folioAcumulado + 1;
    folioAcumulado += d.numeroFolios;
    return { desde, hasta: folioAcumulado };
  });

  const encabezados = ["Orden", "Nombre", "Tipo (MIME)", "Tamaño (bytes)", "Folios", "SHA-256", "Subido por", "Fecha"];
  const filasCsv = expediente.documentos.map((d, i) =>
    [d.ordenIndice, d.nombre, d.mimeType, d.tamanoBytes, `${folios[i]!.desde}-${folios[i]!.hasta}`, d.hashSha256 ?? "", d.subidoPor.nombre, d.createdAt.toISOString()]
      .map(celda)
      .join(";")
  );

  const { ip, userAgent } = datosPeticion(req.headers);
  const formato = req.nextUrl.searchParams.get("formato") === "xml" ? "xml" : "csv";
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó el índice electrónico de ${expediente.numero} a ${formato.toUpperCase()} (${expediente.documentos.length} documento(s))`,
  }).catch((err) => { console.error("No se pudo registrar en la bitácora la exportación del índice:", err); });

  const clasificacion = expediente.serie ? `${expediente.serie.codigo} — ${expediente.serie.nombre}` : "Sin clasificar";

  if (formato === "xml") {
    const documentosXml = expediente.documentos
      .map(
        (d, i) => `    <documento orden="${d.ordenIndice}">
      <nombre>${escaparXml(d.nombre)}</nombre>
      <tipoMime>${escaparXml(d.mimeType)}</tipoMime>
      <tamanoBytes>${d.tamanoBytes}</tamanoBytes>
      <folios desde="${folios[i]!.desde}" hasta="${folios[i]!.hasta}"/>
      <sha256>${escaparXml(d.hashSha256)}</sha256>
      <subidoPor>${escaparXml(d.subidoPor.nombre)}</subidoPor>
      <fecha>${d.createdAt.toISOString()}</fecha>
    </documento>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<indiceElectronico numero="${escaparXml(expediente.numero)}">
  <expediente>
    <numero>${escaparXml(expediente.numero)}</numero>
    <dependencia>${escaparXml(expediente.dependencia.nombre)}</dependencia>
    <clasificacion>${escaparXml(clasificacion)}</clasificacion>
    <estado>${escaparXml(expediente.estado)}</estado>
    <nivelAcceso>${escaparXml(expediente.nivelAcceso)}</nivelAcceso>
    ${expediente.indiceHash ? `<indiceHashFirmadoSha256>${escaparXml(expediente.indiceHash)}</indiceHashFirmadoSha256>` : "<indiceHashFirmadoSha256/>"}
    <hashVerificacionSha256 exportadoEn="${new Date().toISOString()}">${hashVerificacion}</hashVerificacionSha256>
  </expediente>
  <documentos total="${expediente.documentos.length}" totalFolios="${folioAcumulado}">
${documentosXml}
  </documentos>
</indiceElectronico>
`;
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="indice-${expediente.numero}.xml"`,
      },
    });
  }

  const encabezado = [
    `"Expediente";${celda(expediente.numero)}`,
    `"Dependencia";${celda(expediente.dependencia.nombre)}`,
    `"Clasificación (TRD)";${celda(clasificacion)}`,
    `"Estado";${celda(expediente.estado)}`,
    `"Nivel de acceso";${celda(expediente.nivelAcceso)}`,
    expediente.indiceHash ? `"Índice firmado al cerrar (SHA-256)";${celda(expediente.indiceHash)}` : "",
    `"Hash de verificación al exportar (SHA-256)";${celda(hashVerificacion)}`,
    "",
  ].filter(Boolean);

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [...encabezado, encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indice-${expediente.numero}.csv"`,
    },
  });
}
