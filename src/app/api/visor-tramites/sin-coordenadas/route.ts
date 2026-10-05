import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { puntosSincaSinCoordenadas, puntosVitalSinCoordenadas } from "@/lib/visor-puntos-externos";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const capa = req.nextUrl.searchParams.get("capa");

  if (capa === "sinca") {
    if (!sincaConfigurado() || !puedeAccederSeccion(permisos, "SINCA_BASE")) return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
    return NextResponse.json({ puntos: await puntosSincaSinCoordenadas() }, { headers: { "Cache-Control": "private, max-age=300" } });
  }
  if (capa === "vital") {
    if (!puedeAccederSeccion(permisos, "VITAL_BASE")) return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
    return NextResponse.json({ puntos: await puntosVitalSinCoordenadas() }, { headers: { "Cache-Control": "private, max-age=300" } });
  }
  return NextResponse.json({ error: "Capa no válida." }, { status: 400 });
}
