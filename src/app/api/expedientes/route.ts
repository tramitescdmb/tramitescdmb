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
    predioDireccion,
    predio,
    claseSolicitud,
    ubicacion,
    solicitanteUbicacion,
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
      municipio?: string;
      regimenTributario?: "RESPONSABLE_IVA" | "NO_RESPONSABLE_IVA" | "SIMPLE_TRIBUTACION" | "REGIMEN_ESPECIAL" | "OTRO" | null;
      granContribuyente?: boolean;
    };
    municipio: string;
    predioDireccion?: string;
    predio?: {
      nombre?: string;
      catastral?: string;
      matricula?: string;
      areaM2?: number | null;
      areaCultivosM2?: number | null;
      areaBosqueM2?: number | null;
      viviendas?: number | null;
    };
    claseSolicitud?: "NUEVA" | "RENOVACION" | null;
    ubicacion?: { lat: number | null; lon: number | null };
    solicitanteUbicacion?: { lat: number | null; lon: number | null };
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
  // que es la única representación que viaja del formulario (ver MapaUbicacion.tsx). El predio/
  // proyecto y el solicitante son dos ubicaciones independientes (ej. empresa con sede en
  // Bucaramanga pidiendo un permiso para un proyecto en otro municipio) — se calculan por separado.
  function calcularUbicacion(prefijo: string, punto?: { lat: number | null; lon: number | null }) {
    const datos: Record<string, number | null> = {
      [`${prefijo}Lat`]: null,
      [`${prefijo}Lon`]: null,
      [`${prefijo}PlanaX`]: null,
      [`${prefijo}PlanaY`]: null,
      [`${prefijo}CartesianaX`]: null,
      [`${prefijo}CartesianaY`]: null,
      [`${prefijo}CartesianaZ`]: null,
    };
    if (punto?.lat != null && punto?.lon != null && esLatLonValido(punto.lat, punto.lon)) {
      const c = desdeLatLon(punto.lat, punto.lon);
      datos[`${prefijo}Lat`] = c.lat;
      datos[`${prefijo}Lon`] = c.lon;
      datos[`${prefijo}PlanaX`] = c.planaX;
      datos[`${prefijo}PlanaY`] = c.planaY;
      datos[`${prefijo}CartesianaX`] = c.cartesianaX;
      datos[`${prefijo}CartesianaY`] = c.cartesianaY;
      datos[`${prefijo}CartesianaZ`] = c.cartesianaZ;
    }
    return datos;
  }

  const datosUbicacion = {
    ...calcularUbicacion("ubicacion", ubicacion),
    ...calcularUbicacion("solicitanteUbicacion", solicitanteUbicacion),
  };

  // Registro maestro por NIT/cédula: se reutiliza si ya existe (actualizando solo contacto, sin
  // pisar el régimen si esta vez no se mandó) o se crea si es la primera vez que se ve esta
  // identificación — ver el comentario en el modelo Solicitante (prisma/schema.prisma) del porqué.
  const identificacionSolicitante = solicitante.identificacion.trim();
  const solicitanteRecord = await db.solicitante.upsert({
    where: { identificacion: identificacionSolicitante },
    create: {
      tipo: solicitante.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
      identificacion: identificacionSolicitante,
      nombre: solicitante.nombre.trim(),
      regimenTributario: solicitante.regimenTributario || null,
      granContribuyente: Boolean(solicitante.granContribuyente),
      email: solicitante.email?.trim() || null,
      telefono: solicitante.telefono?.trim() || null,
      direccion: solicitante.direccion?.trim() || null,
      municipio: solicitante.municipio?.trim() || null,
    },
    update: {
      nombre: solicitante.nombre.trim(),
      email: solicitante.email?.trim() || undefined,
      telefono: solicitante.telefono?.trim() || undefined,
      direccion: solicitante.direccion?.trim() || undefined,
      municipio: solicitante.municipio?.trim() || undefined,
      ...(solicitante.regimenTributario ? { regimenTributario: solicitante.regimenTributario } : {}),
      ...(solicitante.granContribuyente != null ? { granContribuyente: solicitante.granContribuyente } : {}),
    },
  });

  const expediente = await db.expediente.create({
    data: {
      id: expedienteId,
      numero,
      tramiteTipoId: tramite.id,
      flujoId: flujo.id,
      solicitanteId: solicitanteRecord.id,
      solicitanteTipo: solicitante.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
      solicitanteNombre: solicitante.nombre.trim(),
      solicitanteIdentificacion: identificacionSolicitante,
      solicitanteEmail: solicitante.email?.trim() || null,
      solicitanteTelefono: solicitante.telefono?.trim() || null,
      solicitanteDireccion: solicitante.direccion?.trim() || null,
      predioDireccion: predioDireccion?.trim() || null,
      predioNombre: predio?.nombre?.trim() || null,
      predioCatastral: predio?.catastral?.trim() || null,
      predioMatricula: predio?.matricula?.trim() || null,
      predioAreaM2: predio?.areaM2 ?? null,
      predioAreaCultivosM2: predio?.areaCultivosM2 ?? null,
      predioAreaBosqueM2: predio?.areaBosqueM2 ?? null,
      predioViviendas: predio?.viviendas ?? null,
      claseSolicitud: claseSolicitud || null,
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
