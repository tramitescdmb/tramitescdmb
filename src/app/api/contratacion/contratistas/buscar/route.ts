import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";

/** Busca un Contratista ya registrado por identificación exacta — para autocompletar al crear un expediente. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso." }, { status: 403 });
  }

  const identificacion = req.nextUrl.searchParams.get("identificacion")?.trim();
  if (!identificacion) return NextResponse.json({ error: "Falta la identificación." }, { status: 400 });

  const contratista = await db.contratista.findUnique({ where: { identificacion } });
  if (!contratista) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(contratista);
}
