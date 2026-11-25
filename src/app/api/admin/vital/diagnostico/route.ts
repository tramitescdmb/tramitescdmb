import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { diagnosticarSolicitudVital, sondearServiciosVital, vitalConfigurado } from "@/lib/vital";

export const maxDuration = 120;

/**
 * Solo administrador: /api/admin/vital/diagnostico?idVital=1210009153754726001
 * Muestra qué responde VITAL (anexos, campos de fecha) sin datos personales.
 * Con &sonda=1 prueba los demás servicios del catálogo (&servicio=wsServicio para uno solo).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador." }, { status: 403 });
  if (!vitalConfigurado()) return NextResponse.json({ error: "VITAL no está configurado." }, { status: 503 });
  const idVital = (req.nextUrl.searchParams.get("idVital") ?? "").trim();
  if (!/^\d{10,30}$/.test(idVital)) return NextResponse.json({ error: "Falta idVital (solo dígitos)." }, { status: 400 });
  // ?sonda=1 prueba además los servicios candidatos (wsSolicitudesEstado, wsServicio, …).
  if (req.nextUrl.searchParams.get("sonda") === "1") {
    const solo = (req.nextUrl.searchParams.get("servicio") ?? "").trim();
    if (solo && !/^ws[A-Za-z]{3,40}$/.test(solo)) return NextResponse.json({ error: "Servicio no válido." }, { status: 400 });
    return NextResponse.json({ idVital, sonda: await sondearServiciosVital(idVital, solo ? [solo] : undefined) }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await diagnosticarSolicitudVital(idVital), { headers: { "Cache-Control": "no-store" } });
}
