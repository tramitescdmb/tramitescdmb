import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";
import { actualizarJornada, CALENDARIO_LABORAL_TAG } from "@/lib/calendario-laboral";

/** Actualiza la jornada laboral de la entidad. Solo ADMIN. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/calendario-laboral", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (session.rol !== "ADMIN") {
    volver.searchParams.set("error", "No tiene permiso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const diasSemana = form.getAll("dia").map((v) => Number(v)).filter((n) => Number.isInteger(n));
  try {
    await actualizarJornada({
      diasSemana,
      horaInicio: String(form.get("horaInicio") || ""),
      horaFin: String(form.get("horaFin") || ""),
    });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo guardar la jornada.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  revalidateTag(CALENDARIO_LABORAL_TAG);
  volver.searchParams.set("ok", "Jornada laboral actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
