import { NextResponse } from "next/server";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerEstadisticasNit } from "@/lib/sinca-nit-stats";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  if (!sincaConfigurado()) return NextResponse.json({ message: "SINCA 1.0 no está configurado." }, { status: 503 });

  try {
    const estadisticas = await obtenerEstadisticasNit();
    return NextResponse.json(estadisticas);
  } catch {
    return NextResponse.json({ message: "No se pudieron calcular las estadísticas." }, { status: 502 });
  }
}
