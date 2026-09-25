import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { tieneFirmaOSolicitudEnDocumentoTramite } from "@/lib/tramites-firma";
import { descargarDocumento } from "@/lib/storage";
import { estamparFirmaTramite } from "@/lib/pdf-rotulado";
import { formatearFechaHoraLarga } from "@/lib/fecha";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const doc = await db.expedienteDocumento.findUnique({
    where: { id },
    select: {
      storagePath: true,
      nombre: true,
      mimeType: true,
      expediente: { select: { id: true, numero: true, tramiteTipoId: true } },
      firmas: {
        orderBy: { fechaHora: "asc" },
        select: {
          fechaHora: true,
          hashContenido: true,
          calidad: true,
          usuario: {
            select: { nombre: true, cedulaONit: true, tipoIdentificacionFirma: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, dependencia: { select: { nombre: true } } },
          },
        },
      },
      solicitudesFirma: {
        where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
        orderBy: { completadoEn: "asc" },
        select: { completadoEn: true, usuarioAsignado: { select: { nombre: true, cedulaONit: true, tipoIdentificacionFirma: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, dependencia: { select: { nombre: true } } } } },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederTramite(permisos, doc.expediente.tramiteTipoId) && !(await tieneFirmaOSolicitudEnDocumentoTramite(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite ver este trámite." }, { status: 403 });
  }
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El sello solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  let salida: Uint8Array;
  try {
    const original = await descargarDocumento(doc.storagePath);
    salida = await estamparFirmaTramite(
      original,
      { numeroExpediente: doc.expediente.numero, baseUrl: base },
      [
        ...doc.firmas.map((f) => ({
          nombre: f.usuario.nombre,
          cedulaONit: f.usuario.cedulaONit,
          tipoIdentificacion: f.usuario.tipoIdentificacionFirma,
          denominacionEmpleo: f.usuario.denominacionEmpleo,
          denominacionComplemento: f.usuario.denominacionComplemento,
          sexo: f.usuario.sexo,
          dependencia: f.usuario.dependencia?.nombre ?? null,
          fechaHora: formatearFechaHoraLarga(f.fechaHora),
          hash: f.hashContenido,
          calidad: f.calidad,
        })),
        ...doc.solicitudesFirma.map((s) => ({
          nombre: s.usuarioAsignado.nombre,
          cedulaONit: s.usuarioAsignado.cedulaONit,
          tipoIdentificacion: s.usuarioAsignado.tipoIdentificacionFirma,
          denominacionEmpleo: s.usuarioAsignado.denominacionEmpleo,
          denominacionComplemento: s.usuarioAsignado.denominacionComplemento,
          sexo: s.usuarioAsignado.sexo,
          dependencia: s.usuarioAsignado.dependencia?.nombre ?? null,
          fechaHora: s.completadoEn ? formatearFechaHoraLarga(s.completadoEn) : "",
          hash: "",
          calidad: "VISTO_BUENO",
        })),
      ],
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF con el sello de firma." },
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
