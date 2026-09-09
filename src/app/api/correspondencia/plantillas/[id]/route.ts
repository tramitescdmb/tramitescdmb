import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { editarPlantilla, duplicarPlantilla, esAmbitoValido } from "@/lib/plantillas";

/**
 * Edita una plantilla, la duplica o cambia su estado activo.
 * `accion` = "editar" | "toggle" | "duplicar". Solo administrador de archivo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/plantillas", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar plantillas.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "editar");
  try {
    if (accion === "toggle") {
      await editarPlantilla(id, { activo: String(form.get("activo") || "") === "true" });
    } else if (accion === "duplicar") {
      await duplicarPlantilla(id);
    } else {
      const ambito = String(form.get("ambito") || "");
      await editarPlantilla(id, {
        nombre: String(form.get("nombre") || ""),
        descripcion: String(form.get("descripcion") || ""),
        categoria: String(form.get("categoria") || ""),
        asunto: String(form.get("asunto") || ""),
        cuerpo: String(form.get("cuerpo") || ""),
        ambito: esAmbitoValido(ambito) ? ambito : "AMBAS",
      });
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo actualizar la plantilla.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  volver.searchParams.set(
    "ok",
    accion === "toggle" ? "Estado de la plantilla actualizado." : accion === "duplicar" ? "Plantilla duplicada (queda inactiva hasta que la revise)." : "Plantilla actualizada."
  );
  return NextResponse.redirect(volver, { status: 303 });
}
