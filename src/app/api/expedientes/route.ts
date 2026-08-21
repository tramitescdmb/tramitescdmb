import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generarNumeroExpediente } from "@/lib/expedientes";
import { esMunicipioValido } from "@/lib/municipios";
import { desdeLatLon, esLatLonValido } from "@/lib/coordenadas";

type DocumentoInput = {
  path: string;
  nombre: string;
  descripcion?: string | null;
  mimeType: string;
  tamanoBytes: number;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const {
    id: expedienteId,
    tramiteTipoId,
    flujoId,
    solicitante,
    municipio,
    ubicacion,
    documentos,
  }: {
    id: string;
    tramiteTipoId: string;
    flujoId: string;
    solicitante: {
      tipo: "NATURAL" | "JURIDICA";
      nombre: string;
      identificacion: string;
      email?: string;
      telefono?: string;
      direccion?: string;
    };
    municipio: string;
    ubicacion?: { lat: number | null; lon: number | null; altura?: number | null };
    documentos: DocumentoInput[];
  } = body;

  if (!expedienteId || !tramiteTipoId || !flujoId || !solicitante?.nombre?.trim() || !solicitante?.identificacion?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios del solicitante." }, { status: 400 });
  }

  if (!esMunicipioValido(municipio)) {
    return NextResponse.json(
      { error: "El municipio debe ser uno de los 13 de la jurisdicción de la CDMB." },
      { status: 400 }
    );
  }

  const tramite = await db.tramiteTipo.findUnique({
    where: { id: tramiteTipoId },
    include: { flujos: { include: { pasos: { orderBy: { numero: "asc" }, take: 1 } } } },
  });
  if (!tramite) return NextResponse.json({ error: "Trámite no encontrado." }, { status: 404 });

  const flujo = tramite.flujos.find((f) => f.id === flujoId);
  if (!flujo) return NextResponse.json({ error: "Flujo no encontrado." }, { status: 404 });

  const primerPaso = flujo.pasos[0]?.numero ?? 1;
  const numero = await generarNumeroExpediente(tramite.codigo, tramite.id);

  // Las planas y cartesianas nunca se confían del cliente — se recalculan aquí a partir de lat/lon,
  // que es la única representación que viaja del formulario (ver MapaUbicacion.tsx).
  let datosUbicacion: Record<string, number | null> = {
    ubicacionLat: null,
    ubicacionLon: null,
    ubicacionAltura: null,
    ubicacionPlanaX: null,
    ubicacionPlanaY: null,
    ubicacionCartesianaX: null,
    ubicacionCartesianaY: null,
    ubicacionCartesianaZ: null,
  };
  if (ubicacion?.lat != null && ubicacion?.lon != null && esLatLonValido(ubicacion.lat, ubicacion.lon)) {
    const c = desdeLatLon(ubicacion.lat, ubicacion.lon, ubicacion.altura ?? 0);
    datosUbicacion = {
      ubicacionLat: c.lat,
      ubicacionLon: c.lon,
      ubicacionAltura: c.altura,
      ubicacionPlanaX: c.planaX,
      ubicacionPlanaY: c.planaY,
      ubicacionCartesianaX: c.cartesianaX,
      ubicacionCartesianaY: c.cartesianaY,
      ubicacionCartesianaZ: c.cartesianaZ,
    };
  }

  const expediente = await db.expediente.create({
    data: {
      id: expedienteId,
      numero,
      tramiteTipoId: tramite.id,
      flujoId: flujo.id,
      solicitanteTipo: solicitante.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
      solicitanteNombre: solicitante.nombre.trim(),
      solicitanteIdentificacion: solicitante.identificacion.trim(),
      solicitanteEmail: solicitante.email?.trim() || null,
      solicitanteTelefono: solicitante.telefono?.trim() || null,
      solicitanteDireccion: solicitante.direccion?.trim() || null,
      municipio,
      ...datosUbicacion,
      estado: "RADICADO",
      pasoActualNumero: primerPaso,
      createdById: session.userId,
      responsableActualId: session.userId,
    },
  });

  await db.expedienteEvento.create({
    data: {
      expedienteId: expediente.id,
      tipo: "CREACION",
      descripcion: `Expediente radicado por ${session.nombre} para el trámite "${tramite.nombre}" (flujo: ${flujo.nombre}).`,
      estadoNuevo: "RADICADO",
      usuarioId: session.userId,
    },
  });

  if (Array.isArray(documentos) && documentos.length > 0) {
    await db.expedienteDocumento.createMany({
      data: documentos
        .filter((d) => d?.path && d?.nombre)
        .map((d) => ({
          expedienteId: expediente.id,
          pasoNumero: null,
          nombre: d.nombre,
          descripcion: d.descripcion || null,
          storagePath: d.path,
          mimeType: d.mimeType || "application/octet-stream",
          tamanoBytes: d.tamanoBytes || 0,
          subidoPorId: session.userId,
        })),
    });
  }

  return NextResponse.json({ id: expediente.id, numero: expediente.numero });
}
