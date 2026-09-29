import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { accesoDocumentoArchivo } from "@/lib/firmas-sgdea";
import { asignarFirmantes } from "@/lib/solicitudes-firma";
import { leerFirmantesSolicitud } from "@/lib/firmantes-solicitud";
import { registrarAccesoDenegadoAccion, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const acceso = await accesoDocumentoArchivo(permisos, session.userId, id);
  if (!acceso) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!acceso.puedeSolicitar) {
    await registrarAccesoDenegadoAccion("solicitar firmas sobre un documento del expediente", acceso.doc.expedienteDocumentalId, session, req.headers);
    return NextResponse.json({ error: "No tiene permiso para solicitar firmas en este expediente." }, { status: 403 });
  }

  const leido = leerFirmantesSolicitud(await req.json().catch(() => null));
  if ("error" in leido) return NextResponse.json({ error: leido.error }, { status: 400 });

  try {
    const { ip, userAgent } = datosPeticion(req.headers);
    await asignarFirmantes({ tipo: "documentoArchivo", id }, session.userId, leido.firmantes, ip, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo asignar." }, { status: 400 });
  }
}
