import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { procesarVencimientosFlujos } from "@/lib/flujos-vencimientos";
import { registrarEjecucion } from "@/lib/procesos-programados";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await registrarEjecucion("flujos-vencimientos", "programado", null, () => procesarVencimientosFlujos()));
}

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/procesos", req.url);
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema ejecuta procesos.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    const r = await registrarEjecucion("flujos-vencimientos", "manual", session.userId, () => procesarVencimientosFlujos(session.userId));
    volver.searchParams.set("ok", `Vencimientos revisados: ${r.revisadas} paso(s) con término, ${r.vencidas} vencido(s), ${r.avisadas} marcado(s) y ${r.avanzadas} avanzado(s).`);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo ejecutar el proceso.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
