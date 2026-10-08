import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { buscarTerceros } from "@/lib/terceros";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json({ resultados: await buscarTerceros(q) });
}
