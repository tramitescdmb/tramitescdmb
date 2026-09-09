import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { crearPlantilla, esAmbitoValido } from "@/lib/plantillas";

/** Crea una plantilla de documento (MoReq 3.30/3.31). Solo administrador de archivo. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/plantillas", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const ambito = String(form.get("ambito") || "");
  try {
    await crearPlantilla({
      nombre: String(form.get("nombre") || ""),
      descripcion: String(form.get("descripcion") || ""),
      cuerpo: String(form.get("cuerpo") || ""),
      ambito: esAmbitoValido(ambito) ? ambito : "AMBAS",
    });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo crear la plantilla.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  volver.searchParams.set("ok", "Plantilla creada.");
  return NextResponse.redirect(volver, { status: 303 });
}
