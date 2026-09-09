import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { editarPlantilla, esAmbitoValido } from "@/lib/plantillas";

/**
 * Edita una plantilla o cambia su estado activo. `accion` = "editar" | "toggle".
 * Solo administrador de archivo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/plantillas", req.url);
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
      await editarPlantilla(id, { activo: String(form.get("activo") || "") === "true" });
    } else {
      const ambito = String(form.get("ambito") || "");
      await editarPlantilla(id, {
        nombre: String(form.get("nombre") || ""),
        descripcion: String(form.get("descripcion") || ""),
        cuerpo: String(form.get("cuerpo") || ""),
        ambito: esAmbitoValido(ambito) ? ambito : "AMBAS",
      });
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo actualizar la plantilla.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  volver.searchParams.set("ok", accion === "toggle" ? "Estado de la plantilla actualizado." : "Plantilla actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
