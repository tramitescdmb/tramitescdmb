import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generarNumeroExpediente } from "@/lib/expedientes";
import { buildStoragePath, uploadDocumento } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();

  const tramiteTipoId = String(form.get("tramiteTipoId") || "");
  const flujoId = String(form.get("flujoId") || "");
  const solicitanteTipo = String(form.get("solicitanteTipo") || "NATURAL") as "NATURAL" | "JURIDICA";
  const solicitanteNombre = String(form.get("solicitanteNombre") || "").trim();
  const solicitanteIdentificacion = String(form.get("solicitanteIdentificacion") || "").trim();
  const solicitanteEmail = String(form.get("solicitanteEmail") || "").trim() || null;
  const solicitanteTelefono = String(form.get("solicitanteTelefono") || "").trim() || null;
  const solicitanteDireccion = String(form.get("solicitanteDireccion") || "").trim() || null;

  if (!tramiteTipoId || !flujoId || !solicitanteNombre || !solicitanteIdentificacion) {
    return NextResponse.json({ error: "Faltan campos obligatorios del solicitante." }, { status: 400 });
  }

  const tramite = await db.tramiteTipo.findUnique({
    where: { id: tramiteTipoId },
    include: { documentosRequeridos: true, flujos: { include: { pasos: { orderBy: { numero: "asc" }, take: 1 } } } },
  });
  if (!tramite) return NextResponse.json({ error: "Trámite no encontrado." }, { status: 404 });

  const flujo = tramite.flujos.find((f) => f.id === flujoId);
  if (!flujo) return NextResponse.json({ error: "Flujo no encontrado." }, { status: 404 });

  const primerPaso = flujo.pasos[0]?.numero ?? 1;
  const numero = await generarNumeroExpediente(tramite.codigo, tramite.id);

  const expediente = await db.expediente.create({
    data: {
      numero,
      tramiteTipoId: tramite.id,
      flujoId: flujo.id,
      solicitanteTipo,
      solicitanteNombre,
      solicitanteIdentificacion,
      solicitanteEmail,
      solicitanteTelefono,
      solicitanteDireccion,
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

  // Documentos del checklist del trámite (uno por cada requisito definido)
  for (const req_ of tramite.documentosRequeridos) {
    const file = form.get(`doc_${req_.id}`);
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const path = buildStoragePath(expediente.id, file.name);
      await uploadDocumento(path, buffer, file.type || "application/octet-stream");
      await db.expedienteDocumento.create({
        data: {
          expedienteId: expediente.id,
          pasoNumero: null,
          nombre: req_.nombre,
          descripcion: req_.notas,
          storagePath: path,
          mimeType: file.type || "application/octet-stream",
          tamanoBytes: file.size,
          subidoPorId: session.userId,
        },
      });
    }
  }

  // Documentos adicionales sin checklist fijo (uso libre)
  const extras = form.getAll("documentos_extra");
  for (const file of extras) {
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const path = buildStoragePath(expediente.id, file.name);
      await uploadDocumento(path, buffer, file.type || "application/octet-stream");
      await db.expedienteDocumento.create({
        data: {
          expedienteId: expediente.id,
          pasoNumero: null,
          nombre: file.name,
          descripcion: "Documento adicional aportado por el solicitante.",
          storagePath: path,
          mimeType: file.type || "application/octet-stream",
          tamanoBytes: file.size,
          subidoPorId: session.userId,
        },
      });
    }
  }

  return NextResponse.redirect(new URL(`/expedientes/${expediente.id}`, req.url), { status: 303 });
}
