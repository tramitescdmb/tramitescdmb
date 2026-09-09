import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { crearTermino } from "@/lib/vocabulario";

/** Crea un término del vocabulario controlado (MoReq 1.17). Solo administrador de archivo. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/vocabulario", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  try {
    await crearTermino(String(form.get("termino") || ""), String(form.get("categoria") || ""));
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo crear el término.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  volver.searchParams.set("ok", "Término agregado al vocabulario.");
  return NextResponse.redirect(volver, { status: 303 });
}
