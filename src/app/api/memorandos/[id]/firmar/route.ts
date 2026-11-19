import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos } from "@/lib/memorandos";
import { completarSolicitudFirma } from "@/lib/solicitudes-firma";
import { datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/**
 * Firma de quien proyectó o revisó un memorando: completa la solicitud de firma que se le creó al
 * enviarlo. La firma queda sobre el mismo radicado, asunto y contenido que firmó quien lo envió.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const ctx = await contextoMemorandos(session.userId, permisos);
  const solicitud = await db.solicitudFirma.findFirst({
    where: { comunicacionId: id, usuarioAsignadoId: session.userId, estado: "PENDIENTE", rol: "FIRMA", comunicacion: { tipo: "INTERNA" } },
    select: { id: true },
  });
  if (!solicitud) return NextResponse.json({ error: "No tiene una firma pendiente en este memorando." }, { status: 400 });
  // Es el permiso de firma de la ficha del usuario, no el del SGDEA: el módulo de memorandos va aparte.
  if (!ctx.acceso || !permisos.puedeFirmar) {
    await registrarAccesoDenegadoAccion("firmar el memorando", id, session, req.headers);
    return NextResponse.json({ error: "Su usuario no tiene habilitada la firma electrónica: pídalo al administrador del sistema." }, { status: 403 });
  }
  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    // completarSolicitudFirma ya deja la auditoría de la firma (acción FIRMA sobre la comunicación).
    await completarSolicitudFirma(solicitud.id, session.userId, ip, userAgent);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar la firma." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
