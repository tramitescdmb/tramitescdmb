import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

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
      documentos: { orderBy: { ordenIndice: "asc" }, include: { subidoPor: { select: { nombre: true } } } },
    },
  });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });

  const encabezados = ["Orden", "Nombre", "Tipo (MIME)", "Tamaño (bytes)", "SHA-256", "Subido por", "Fecha"];
  const filasCsv = expediente.documentos.map((d) =>
    [d.ordenIndice, d.nombre, d.mimeType, d.tamanoBytes, d.hashSha256 ?? "", d.subidoPor.nombre, d.createdAt.toISOString()]
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
        (d) => `    <documento orden="${d.ordenIndice}">
      <nombre>${escaparXml(d.nombre)}</nombre>
      <tipoMime>${escaparXml(d.mimeType)}</tipoMime>
      <tamanoBytes>${d.tamanoBytes}</tamanoBytes>
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
    ${expediente.indiceHash ? `<indiceHashSha256>${escaparXml(expediente.indiceHash)}</indiceHashSha256>` : "<indiceHashSha256/>"}
  </expediente>
  <documentos total="${expediente.documentos.length}">
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
    expediente.indiceHash ? `"Índice firmado (SHA-256)";${celda(expediente.indiceHash)}` : "",
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
