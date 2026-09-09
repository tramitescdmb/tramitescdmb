import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";
import { crearDiaNoLaborado, CALENDARIO_LABORAL_TAG } from "@/lib/calendario-laboral";

/** Registra un día no laborado (día compensado / cierre institucional). Solo ADMIN. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/calendario-laboral", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (session.rol !== "ADMIN") {
    volver.searchParams.set("error", "No tiene permiso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  try {
    await crearDiaNoLaborado(String(form.get("fecha") || ""), String(form.get("motivo") || ""));
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo registrar el día.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  revalidateTag(CALENDARIO_LABORAL_TAG);
  volver.searchParams.set("ok", "Día no laborado registrado.");
  return NextResponse.redirect(volver, { status: 303 });
}
