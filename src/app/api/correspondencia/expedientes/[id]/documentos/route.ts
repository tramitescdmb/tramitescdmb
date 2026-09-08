import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { agregarDocumentoArchivo } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { parsearFechaLocal } from "@/lib/periodo-dashboard";

type DocumentoSubido = { path: string; nombre: string; mimeType: string; tamanoBytes: number; hashSha256: string | null };

/** Registra en el índice electrónico uno o más documentos ya subidos al storage. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { id: true, numero: true, dependenciaId: true } });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (!puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId)) {
    return NextResponse.json({ error: "No tiene permiso para agregar documentos a este expediente." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const documentos: DocumentoSubido[] = Array.isArray(body?.documentos) ? body.documentos : [];
  if (documentos.length === 0) return NextResponse.json({ error: "No se recibió ningún documento." }, { status: 400 });
  const fechaDocumentoRaw = typeof body?.fechaDocumento === "string" ? body.fechaDocumento : "";
  const fechaDocumento = fechaDocumentoRaw ? parsearFechaLocal(fechaDocumentoRaw) : null;
  const tipoDocumentalId = typeof body?.tipoDocumentalId === "string" && body.tipoDocumentalId ? body.tipoDocumentalId : null;

  const nombres: string[] = [];
  try {
    for (const doc of documentos) {
      if (!doc.path || !doc.nombre) continue;
      await agregarDocumentoArchivo({
        expedienteDocumentalId: id,
        nombre: doc.nombre,
        storagePath: doc.path,
        mimeType: doc.mimeType || "application/octet-stream",
        tamanoBytes: doc.tamanoBytes || 0,
        hashSha256: doc.hashSha256 || null,
        subidoPorId: session.userId,
        fechaDocumento,
        tipoDocumentalId,
      });
      nombres.push(doc.nombre);
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudieron agregar los documentos." }, { status: 400 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "CREA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Agregó ${nombres.length} documento(s) a ${expediente.numero}: ${nombres.join(", ").slice(0, 300)}`,
  });

  return NextResponse.json({ ok: true, agregados: nombres.length });
}
