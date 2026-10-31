import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { procesarAlertasCorreo } from "@/lib/alertas-correo";
import { registrarEjecucion } from "@/lib/procesos-programados";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await registrarEjecucion("alertas-correo", "programado", null, () => procesarAlertasCorreo()));
}

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/procesos", req.url);
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema ejecuta procesos.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    const r = await registrarEjecucion("alertas-correo", "manual", session.userId, () => procesarAlertasCorreo());
    volver.searchParams.set(
      r.ok ? "ok" : "error",
      r.motivo ?? `Alertas por correo: ${r.alertas} alerta(s) nuevas para ${r.usuarios} persona(s); ${r.correos} correo(s) enviados${r.fallidos ? `, ${r.fallidos} fallido(s)` : ""}.`
    );
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo ejecutar el proceso.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
