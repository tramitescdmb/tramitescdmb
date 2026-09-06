import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el índice electrónico de un expediente documental a CSV (MoReq 1.47). */
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
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó el índice electrónico de ${expediente.numero} (${expediente.documentos.length} documento(s))`,
  }).catch((err) => { console.error("No se pudo registrar en la bitácora la exportación del índice:", err); });

  const encabezado = [
    `"Expediente";${celda(expediente.numero)}`,
    `"Dependencia";${celda(expediente.dependencia.nombre)}`,
    `"Clasificación (TRD)";${celda(expediente.serie ? `${expediente.serie.codigo} — ${expediente.serie.nombre}` : "Sin clasificar")}`,
    `"Estado";${celda(expediente.estado)}`,
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
