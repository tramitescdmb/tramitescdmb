import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeResponderComoAsignado } from "@/lib/permisos";
import { registrarRespuestaFuncionario, type EntradaDocumento } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/**
 * Guarda el borrador de respuesta del funcionario a quien se distribuyó una
 * RECIBIDA — no radica nada, es la constancia de qué respondió (texto y/o
 * documentos ya redactados) para que ventanilla/gestión documental la radique
 * como oficio de salida.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso al módulo de correspondencia." }, { status: 403 });
  }

  const comunicacion = await db.comunicacion.findUnique({
    where: { id },
    select: {
      radicado: true,
      distribuciones: {
        where: { activa: true },
        select: { usuarioId: true, dependenciaId: true },
      },
    },
  });
  if (!comunicacion) return NextResponse.json({ error: "La comunicación no existe." }, { status: 404 });

  if (!puedeResponderComoAsignado(permisos, session.userId, comunicacion.distribuciones)) {
    return NextResponse.json({ error: "Esta comunicación no está distribuida a usted ni a su dependencia." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const texto = String(body.texto ?? "");
  const documentos: EntradaDocumento[] = Array.isArray(body.documentos)
    ? (body.documentos as unknown[])
        .map((d) => {
          const doc = d as Record<string, unknown>;
          return {
            path: String(doc.path ?? ""),
            nombre: String(doc.nombre ?? "archivo"),
            descripcion: doc.descripcion ? String(doc.descripcion) : null,
            mimeType: String(doc.mimeType ?? "application/octet-stream"),
            tamanoBytes: Math.max(0, Math.floor(Number(doc.tamanoBytes) || 0)),
            hashSha256: doc.hashSha256 ? String(doc.hashSha256) : null,
          };
        })
        .filter((d) => d.path)
    : [];

  try {
    await registrarRespuestaFuncionario(id, session.userId, texto, documentos);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar la respuesta." }, { status: 400 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "RESPONDE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} guardó la respuesta de ${comunicacion.radicado} (borrador, pendiente de radicar como oficio de salida)${documentos.length ? ` con ${documentos.length} documento(s) adjunto(s)` : ""}`,
  });

  return NextResponse.json({ ok: true });
}
