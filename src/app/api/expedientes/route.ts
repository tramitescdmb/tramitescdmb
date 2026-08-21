import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generarNumeroExpediente } from "@/lib/expedientes";

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
    documentos: DocumentoInput[];
  } = body;

  if (!expedienteId || !tramiteTipoId || !flujoId || !solicitante?.nombre?.trim() || !solicitante?.identificacion?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios del solicitante." }, { status: 400 });
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
