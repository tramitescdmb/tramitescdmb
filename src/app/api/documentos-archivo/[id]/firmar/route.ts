import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { accesoDocumentoArchivo } from "@/lib/firmas-sgdea";
import { firmarDocumentoArchivoDirecto } from "@/lib/solicitudes-firma";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const acceso = await accesoDocumentoArchivo(permisos, session.userId, id);
  if (!acceso) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!acceso.puedeFirmarDirecto) {
    await registrarAccesoDenegadoAccion("firmar un documento del expediente", acceso.doc.expedienteDocumentalId, session, req.headers);
    return NextResponse.json({ error: "No tiene permiso para firmar documentos de este expediente." }, { status: 403 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await firmarDocumentoArchivoDirecto(id, session.userId, ip, userAgent);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar la firma." }, { status: 400 });
  }
  await registrarAuditoriaDoc({
    entidad: "DocumentoArchivo",
    entidadId: id,
    accion: "FIRMA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Firmó "${acceso.doc.nombre}" del expediente ${acceso.doc.expediente.numero}`,
  }).catch((e) => console.error("registrarAuditoriaDoc (firmar archivo) falló:", e));
  return NextResponse.json({ ok: true });
}
