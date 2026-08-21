import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sincronizarTramite } from "@/lib/vital";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede sincronizar con VITAL." }, { status: 403 });
  }

  const form = await req.formData();
  const idTramite = Number(form.get("idTramite"));
  const fechaInicio = String(form.get("fechaInicio") || "");
  const fechaFin = String(form.get("fechaFin") || "");

  if (!idTramite || !fechaInicio || !fechaFin) {
    return NextResponse.json({ error: "Faltan id_tramite, fecha_inicio o fecha_fin." }, { status: 400 });
  }

  try {
    const resultado = await sincronizarTramite({ idTramite, fechaInicio, fechaFin });
    return NextResponse.redirect(
      new URL(
        `/vital?sincronizado=${resultado.total}&errores=${encodeURIComponent(resultado.errores.join(" | "))}`,
        req.url
      ),
      { status: 303 }
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al sincronizar con VITAL.";
    return NextResponse.redirect(new URL(`/vital?error=${encodeURIComponent(mensaje)}`, req.url), { status: 303 });
  }
}
