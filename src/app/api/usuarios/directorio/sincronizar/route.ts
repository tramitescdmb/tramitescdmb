import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { sincronizarDirectorioNocturno } from "@/lib/directorio-usuarios";
import { registrarEjecucion } from "@/lib/procesos-programados";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await registrarEjecucion("directorio", "programado", null, () => sincronizarDirectorioNocturno()));
}

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/procesos", req.url);
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema ejecuta procesos.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    const r = await registrarEjecucion("directorio", "manual", session.userId, () => sincronizarDirectorioNocturno());
    if (!r.ok) volver.searchParams.set("error", r.mensaje ?? "No se pudo sincronizar con el directorio activo.");
    else
      volver.searchParams.set(
        "ok",
        r.temporales === 0
          ? "No hay cuentas temporales pendientes del dominio."
          : `Cuentas temporales: ${r.temporales} revisadas, ${r.convertidos} pasadas al dominio y ${r.pendientes} todavía sin credenciales de red.`,
      );
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo ejecutar el proceso.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
