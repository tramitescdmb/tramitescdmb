import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";

/** Busca un Solicitante ya registrado por identificación exacta — para autocompletar al radicar. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSolicitantes(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a ningún trámite." }, { status: 403 });
  }

  const identificacion = req.nextUrl.searchParams.get("identificacion")?.trim();
  if (!identificacion) return NextResponse.json({ error: "Falta la identificación." }, { status: 400 });

  const solicitante = await db.solicitante.findUnique({ where: { identificacion } });
  if (!solicitante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(solicitante);
}
