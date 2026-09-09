import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { editarTermino } from "@/lib/vocabulario";

/** Edita o activa/desactiva un término. `accion` = "editar" | "toggle". Solo administrador de archivo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/vocabulario", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "editar");
  try {
    if (accion === "toggle") {
      await editarTermino(id, { activo: String(form.get("activo") || "") === "true" });
    } else {
      await editarTermino(id, { termino: String(form.get("termino") || ""), categoria: String(form.get("categoria") || "") });
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo actualizar el término.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  volver.searchParams.set("ok", "Vocabulario actualizado.");
  return NextResponse.redirect(volver, { status: 303 });
}
