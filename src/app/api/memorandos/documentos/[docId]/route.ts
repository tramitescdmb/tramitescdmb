import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos, puedeVerMemorando } from "@/lib/memorandos";
import { getSignedDownloadUrl } from "@/lib/storage";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Abre un adjunto de un memorando, para quien puede ver ese memorando. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  const doc = await db.comunicacionDocumento.findUnique({
    where: { id: docId },
    select: { storagePath: true, nombre: true, comunicacionId: true, comunicacion: { select: { radicado: true } } },
  });
  if (!doc || !(await puedeVerMemorando(ctx, doc.comunicacionId))) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ComunicacionDocumento",
    entidadId: docId,
    accion: "LEE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Abrió el adjunto "${doc.nombre}" del memorando ${doc.comunicacion.radicado}`,
  });
  return NextResponse.redirect(await getSignedDownloadUrl(doc.storagePath));
}
