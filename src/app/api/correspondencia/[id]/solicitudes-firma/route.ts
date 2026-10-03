import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAsignarFirmantesComunicacion } from "@/lib/permisos";
import { asignarFirmantes } from "@/lib/solicitudes-firma";
import { leerFirmantesSolicitud } from "@/lib/firmantes-solicitud";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const c = await db.comunicacion.findUnique({ where: { id }, select: { radicadoPorId: true } });
  if (!c) return NextResponse.json({ error: "La comunicación no existe." }, { status: 404 });
  if (!puedeAsignarFirmantesComunicacion(permisos, c, session.userId)) {
    return NextResponse.json(
      { error: "La ventanilla de radicación no solicita firmas: las gestionan los funcionarios que proyectan, revisan o firman el documento." },
      { status: 403 }
    );
  }

  const leido = leerFirmantesSolicitud(await req.json().catch(() => null));
  if ("error" in leido) return NextResponse.json({ error: leido.error }, { status: 400 });

  try {
    const { ip, userAgent } = datosPeticion(req.headers);
    await asignarFirmantes({ tipo: "comunicacion", id }, session.userId, leido.firmantes, ip, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo asignar." }, { status: 400 });
  }
}
