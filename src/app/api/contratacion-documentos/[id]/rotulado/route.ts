import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerDocumentoContrato, tieneSolicitudFirmaEnExpedienteContractual, tieneFirmaOSolicitudEnDocumentoContrato } from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { descargarDocumento } from "@/lib/storage";
import { estamparFirmaGecon } from "@/lib/pdf-rotulado";
import { metadatosPdf } from "@/lib/metadatos-pdf";
import { identidadFirmante } from "@/lib/contratacion";
import { cargoDelFirmante, nivelFirma } from "@/lib/jerarquia-firma";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { servirDerivado, huellaDerivado } from "@/lib/derivados";
import { accesoDesdeArchivoSgdea } from "@/lib/acceso-archivo-modulos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: {
      hashSha256: true,
      storagePath: true,
      nombre: true,
      mimeType: true,
      etapa: true,
      expediente: {
        select: {
          id: true,
          numero: true,
          contratistaId: true,
          dependenciaSolicitanteId: true,
          etapaActual: true,
          eliminado: true,
        },
      },
      firmas: {
        orderBy: { fechaHora: "asc" },
        select: {
          fechaHora: true,
          hashContenido: true,
          calidad: true,
          usuario: {
            select: {
              nombre: true,
              cedulaONit: true,
              tipoIdentificacionFirma: true,
              denominacionEmpleo: true,
              denominacionComplemento: true,
              sexo: true,
              rolContratacion: true,
              dependencia: { select: { nombre: true } },
              contratista: { select: { identificacion: true, contactoEmail: true, tipoPersona: true } },
            },
          },
        },
      },
      solicitudesFirma: {
        where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
        orderBy: { completadoEn: "asc" },
        select: {
          completadoEn: true,
          usuarioAsignado: {
            select: {
              nombre: true,
              cedulaONit: true,
              tipoIdentificacionFirma: true,
              denominacionEmpleo: true,
              denominacionComplemento: true,
              sexo: true,
              rolContratacion: true,
              dependencia: { select: { nombre: true } },
              contratista: { select: { identificacion: true, contactoEmail: true, tipoPersona: true } },
            },
          },
        },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  const permitido =
    !doc.expediente.eliminado &&
    (puedeVerDocumentoContrato(permisos, doc.expediente, doc.etapa) ||
      (await tieneSolicitudFirmaEnExpedienteContractual(session.userId, doc.expediente.id)) ||
      (await tieneFirmaOSolicitudEnDocumentoContrato(session.userId, id)) ||
      (!(permisos.contratacion === "CONTRATISTA" && doc.etapa === "PRECONTRACTUAL") &&
        (await accesoDesdeArchivoSgdea({
          permisos,
          origen: "GECON",
          origenId: doc.expediente.id,
          usuarioId: session.userId,
          documento: doc.nombre,
          headers: req.headers,
        }))));
  if (!permitido) {
    await registrarAccesoDenegadoAccion("descargar el rótulo firmado de un documento de contratación", id, session, req.headers);
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El rótulo solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  const datos = {
    numeroExpediente: doc.expediente.numero,
    baseUrl: base,
    metadatos: metadatosPdf({ tipo: "G", id, baseUrl: base, documento: doc.nombre, referencia: doc.expediente.numero, hashArchivo: doc.hashSha256 }),
  };
  const firmantes = [
    ...doc.firmas.map((f) => ({
      nombre: f.usuario.nombre,
      cedulaONit: identidadFirmante(f.usuario).cedulaONit,
      tipoIdentificacion: identidadFirmante(f.usuario).tipoIdentificacion,
      denominacionEmpleo: f.usuario.denominacionEmpleo,
      denominacionComplemento: f.usuario.denominacionComplemento,
      sexo: f.usuario.sexo,
      dependencia: f.usuario.dependencia?.nombre ?? null,
      fechaHora: formatearFechaHoraLarga(f.fechaHora),
      hash: f.hashContenido,
      calidad: f.calidad,
      cargo: cargoDelFirmante(f.usuario, "GECON"),
      nivel: nivelFirma(f.usuario),
    })),
    ...doc.solicitudesFirma.map((s) => ({
      nombre: s.usuarioAsignado.nombre,
      cedulaONit: identidadFirmante(s.usuarioAsignado).cedulaONit,
      tipoIdentificacion: identidadFirmante(s.usuarioAsignado).tipoIdentificacion,
      denominacionEmpleo: s.usuarioAsignado.denominacionEmpleo,
      denominacionComplemento: s.usuarioAsignado.denominacionComplemento,
      sexo: s.usuarioAsignado.sexo,
      dependencia: s.usuarioAsignado.dependencia?.nombre ?? null,
      fechaHora: s.completadoEn ? formatearFechaHoraLarga(s.completadoEn) : "",
      hash: "",
      calidad: "VISTO_BUENO",
      cargo: cargoDelFirmante(s.usuarioAsignado, "GECON"),
      nivel: nivelFirma(s.usuarioAsignado),
    })),
  ];

  const slug = doc.nombre.replace(/[^A-Za-z0-9-]/g, "_").slice(0, 60);
  try {
    return await servirDerivado({
      carpeta: `gecon/${id}`,
      huella: huellaDerivado(doc.storagePath, datos, firmantes),
      nombreArchivo: `${slug}-firmado.pdf`,
      contentType: "application/pdf",
      generar: async () => estamparFirmaGecon(await descargarDocumento(doc.storagePath), datos, firmantes),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF con rótulo." },
      { status: 500 },
    );
  }
}
