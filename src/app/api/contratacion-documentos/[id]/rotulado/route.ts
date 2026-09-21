import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual, tieneSolicitudFirmaEnExpedienteContractual, tieneFirmaOSolicitudEnDocumentoContrato } from "@/lib/permisos";
import { descargarDocumento } from "@/lib/storage";
import { estamparFirmaSigec } from "@/lib/pdf-rotulado";
import { formatearFechaHoraLarga } from "@/lib/fecha";

/**
 * Descarga de un documento de contratación PDF CON el sello de firma electrónica estampado al
 * pie (nombre, fecha, hash SHA-256 completo) y un QR de verificación en la esquina superior —
 * antes SIGEC guardaba la firma solo en base de datos, sin marcar nunca el archivo. A diferencia
 * de SGDEA, NO lleva ningún rótulo de radicación de correspondencia (un expediente contractual no
 * tiene radicado) — usa `estamparFirmaSigec`, no el `estamparRotulo` compartido. El original en
 * Storage no se modifica.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: {
      storagePath: true,
      nombre: true,
      mimeType: true,
      expediente: {
        select: {
          id: true,
          numero: true,
          contratistaId: true,
          dependenciaSolicitanteId: true,
        },
      },
      firmas: {
        orderBy: { fechaHora: "asc" },
        select: {
          fechaHora: true,
          hashContenido: true,
          usuario: {
            select: {
              nombre: true,
              cedulaONit: true,
              denominacionEmpleo: true,
              denominacionComplemento: true,
              sexo: true,
              dependencia: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (
    !puedeVerExpedienteContractual(permisos, doc.expediente) &&
    !(await tieneSolicitudFirmaEnExpedienteContractual(session.userId, doc.expediente.id)) &&
    !(await tieneFirmaOSolicitudEnDocumentoContrato(session.userId, id))
  ) {
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El rótulo solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  let salida: Uint8Array;
  try {
    const original = await descargarDocumento(doc.storagePath);
    salida = await estamparFirmaSigec(
      original,
      { numeroExpediente: doc.expediente.numero, baseUrl: base },
      doc.firmas.map((f) => ({
        nombre: f.usuario.nombre,
        cedulaONit: f.usuario.cedulaONit,
        denominacionEmpleo: f.usuario.denominacionEmpleo,
        denominacionComplemento: f.usuario.denominacionComplemento,
        sexo: f.usuario.sexo,
        dependencia: f.usuario.dependencia?.nombre ?? null,
        fechaHora: formatearFechaHoraLarga(f.fechaHora),
        hash: f.hashContenido,
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF con rótulo." },
      { status: 500 },
    );
  }

  const slug = doc.nombre.replace(/[^A-Za-z0-9-]/g, "_").slice(0, 60);
  return new NextResponse(Buffer.from(salida), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}-firmado.pdf"`,
    },
  });
}
