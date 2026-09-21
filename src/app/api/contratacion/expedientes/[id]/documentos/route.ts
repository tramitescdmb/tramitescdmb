import { NextRequest, NextResponse } from "next/server";
import type { EtapaContratacion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeSubirDocumentoContrato } from "@/lib/permisos";
import { agregarDocumentoContrato, ETAPAS_ORDEN } from "@/lib/contratacion";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";

/**
 * Confirma un documento YA SUBIDO al storage (solo metadatos en este POST, no
 * el archivo — ver src/lib/uploads-client.ts `subirArchivoContrato`). Vuelve a
 * validar el tamaño en el servidor: nunca confiar solo en la compresión/tope
 * del cliente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    select: { id: true, contratistaId: true, cerrado: true },
  });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const etapa = body.etapa as EtapaContratacion;
  if (!(ETAPAS_ORDEN as string[]).includes(etapa)) {
    return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  }
  if (!puedeSubirDocumentoContrato(permisos, expediente, etapa)) {
    return NextResponse.json({ error: "No tiene permiso para subir documentos en esta etapa de este expediente." }, { status: 403 });
  }

  const nombre = String(body.nombre || "").trim();
  const storagePath = String(body.storagePath || "").trim();
  const mimeType = String(body.mimeType || "").trim();
  const tamanoBytes = Number(body.tamanoBytes) || 0;
  if (!nombre || !storagePath || !mimeType) {
    return NextResponse.json({ error: "Faltan datos del archivo subido." }, { status: 400 });
  }
  if (tamanoBytes > TAMANO_MAXIMO_CONTRATACION_BYTES) {
    return NextResponse.json({ error: mensajeArchivoDemasiadoGrandeContratacion(nombre) }, { status: 400 });
  }

  try {
    const documento = await agregarDocumentoContrato({
      expedienteId: id,
      etapa,
      categoria: body.categoria ? String(body.categoria) : null,
      requisitoId: body.requisitoId ? String(body.requisitoId) : null,
      nombre,
      storagePath,
      mimeType,
      tamanoBytes,
      hashSha256: body.hashSha256 ? String(body.hashSha256) : null,
      subidoPorId: session.userId,
      requiereFirma: Boolean(body.requiereFirma),
      firmadoEnSecop: Boolean(body.firmadoEnSecop),
      periodoMes: body.periodoMes ? String(body.periodoMes) : null,
      periodoEventualId: body.periodoEventualId ? String(body.periodoEventualId) : null,
    });
    return NextResponse.json({ id: documento.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar el documento." }, { status: 400 });
  }
}
