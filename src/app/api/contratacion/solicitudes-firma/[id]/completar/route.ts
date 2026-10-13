import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { completarSolicitudFirma } from "@/lib/solicitudes-firma";
import { db } from "@/lib/db";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const solicitud = await db.solicitudFirma.findUnique({
    where: { id },
    select: { documentoContrato: { select: { etapa: true } }, usuarioAsignado: { select: { rolesContratacion: true } } },
  });
  if (solicitud?.documentoContrato?.etapa === "PRECONTRACTUAL" && solicitud.usuarioAsignado.rolesContratacion.includes("CONTRATISTA")) {
    return NextResponse.json({ error: "El contratista no firma ni da visto bueno a documentos de la etapa Precontractual: solo puede consultarlos." }, { status: 403 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await completarSolicitudFirma(id, session.userId, ip, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo completar la solicitud." }, { status: 400 });
  }
}
