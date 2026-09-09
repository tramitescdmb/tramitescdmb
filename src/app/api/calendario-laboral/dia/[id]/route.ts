import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";
import { cambiarEstadoDiaNoLaborado, eliminarDiaNoLaborado, CALENDARIO_LABORAL_TAG } from "@/lib/calendario-laboral";

/** `accion` = "toggle" | "eliminar" sobre un día no laborado. Solo ADMIN. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/calendario-laboral", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (session.rol !== "ADMIN") {
    volver.searchParams.set("error", "No tiene permiso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "toggle");
  try {
    if (accion === "eliminar") await eliminarDiaNoLaborado(id);
    else await cambiarEstadoDiaNoLaborado(id, String(form.get("activo") || "") === "true");
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo actualizar.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  revalidateTag(CALENDARIO_LABORAL_TAG);
  volver.searchParams.set("ok", accion === "eliminar" ? "Día eliminado." : "Día actualizado.");
  return NextResponse.redirect(volver, { status: 303 });
}
