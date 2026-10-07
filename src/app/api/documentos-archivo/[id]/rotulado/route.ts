import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { accesoDocumentoArchivo } from "@/lib/firmas-sgdea";
import { descargarDocumento } from "@/lib/storage";
import { estamparFirmaSgdea } from "@/lib/pdf-rotulado";
import { metadatosPdf } from "@/lib/metadatos-pdf";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { servirDerivado, huellaDerivado } from "@/lib/derivados";
import { cargoDelFirmante, nivelFirma } from "@/lib/jerarquia-firma";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

const USUARIO_SELLO = {
  nombre: true,
  cedulaONit: true,
  tipoIdentificacionFirma: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  sexo: true,
  rolesContratacion: true,
  dependencia: { select: { nombre: true } },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const acceso = await accesoDocumentoArchivo(permisos, session.userId, id);
  if (!acceso) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!acceso.puedeVer) return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  const { doc } = acceso;
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El sello solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const [firmas, vistos] = await Promise.all([
    db.firma.findMany({
      where: { documentoArchivoId: id },
      orderBy: { fechaHora: "asc" },
      select: { fechaHora: true, hashContenido: true, calidad: true, usuario: { select: USUARIO_SELLO } },
    }),
    db.solicitudFirma.findMany({
      where: { documentoArchivoId: id, rol: "VISTO_BUENO", estado: "COMPLETADA" },
      orderBy: { completadoEn: "asc" },
      select: { completadoEn: true, usuarioAsignado: { select: USUARIO_SELLO } },
    }),
  ]);

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const datos = {
    numeroExpediente: doc.expediente.numero,
    baseUrl: base,
    metadatos: metadatosPdf({ tipo: "A", id, baseUrl: base, documento: doc.nombre, referencia: doc.expediente.numero, hashArchivo: doc.hashSha256 }),
  };
  const aSello = (u: (typeof firmas)[number]["usuario"]) => ({
    nombre: u.nombre,
    cedulaONit: u.cedulaONit,
    tipoIdentificacion: u.tipoIdentificacionFirma,
    denominacionEmpleo: u.denominacionEmpleo,
    denominacionComplemento: u.denominacionComplemento,
    sexo: u.sexo,
    dependencia: u.dependencia?.nombre ?? null,
    cargo: cargoDelFirmante(u, "SGDEA"),
    nivel: nivelFirma(u),
  });
  const firmantes = [
    ...firmas.map((f) => ({ ...aSello(f.usuario), fechaHora: formatearFechaHoraLarga(f.fechaHora), hash: f.hashContenido, calidad: f.calidad })),
    ...vistos.map((v) => ({
      ...aSello(v.usuarioAsignado),
      fechaHora: v.completadoEn ? formatearFechaHoraLarga(v.completadoEn) : "",
      hash: "",
      calidad: "VISTO_BUENO",
    })),
  ];

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "DocumentoArchivo",
    entidadId: id,
    accion: "LEE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Abrió "${doc.nombre}" con sello de firmas (${doc.expediente.numero})`,
  }).catch((e) => console.error("registrarAuditoriaDoc (rotulado archivo) falló:", e));

  const slug = doc.nombre.replace(/[^A-Za-z0-9-]/g, "_").slice(0, 60);
  try {
    return await servirDerivado({
      carpeta: `sgdea-archivo/${id}`,
      huella: huellaDerivado(doc.storagePath, datos, firmantes),
      nombreArchivo: `${slug}-firmado.pdf`,
      contentType: "application/pdf",
      generar: async () => estamparFirmaSgdea(await descargarDocumento(doc.storagePath), datos, firmantes),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo generar el PDF con el sello de firma." }, { status: 500 });
  }
}
