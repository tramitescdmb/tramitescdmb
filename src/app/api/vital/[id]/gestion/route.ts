import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeConvertirSolicitudVital } from "@/lib/permisos";
import { resolverAvisoSolicitudVital } from "@/lib/vital-gestion";

/**
 * Descartar una solicitud de VITAL (no da lugar a trámite, p. ej. un reporte) o
 * volverla a «nueva». Convertirla en trámite se hace al radicar el expediente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeConvertirSolicitudVital(permisos)) {
    return NextResponse.json({ error: "Solo el administrador y el Subdirector(a) de Evaluación y Control Ambiental gestionan las solicitudes de VITAL." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { accion?: string; motivo?: string } | null;
  const solicitud = await db.solicitudVital.findUnique({ where: { id }, select: { id: true, expedienteId: true } });
  if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  if (solicitud.expedienteId) {
    return NextResponse.json({ error: "Esta solicitud ya se convirtió en trámite." }, { status: 409 });
  }

  if (body?.accion === "descartar") {
    const motivo = String(body.motivo ?? "").trim().slice(0, 1000);
    if (!motivo) return NextResponse.json({ error: "Indique por qué no se convierte en trámite." }, { status: 400 });
    await db.solicitudVital.update({
      where: { id },
      data: { gestion: "DESCARTADA", motivoDescarte: motivo, gestionadaEn: new Date(), gestionadaPorId: session.userId },
    });
    await resolverAvisoSolicitudVital(id);
    return NextResponse.json({ ok: true });
  }
  if (body?.accion === "reabrir") {
    await db.solicitudVital.update({
      where: { id },
      data: { gestion: "NUEVA", motivoDescarte: null, gestionadaEn: null, gestionadaPorId: null },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
