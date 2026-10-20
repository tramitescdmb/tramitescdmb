import { NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { buscarGlobal } from "@/lib/busqueda-global";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
  const permisos = await obtenerPermisosUsuario(session.userId);
  const grupos = await buscarGlobal(q, permisos);
  return NextResponse.json({ grupos });
}
