import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { ejecutarMantenimientoCorreo } from "@/lib/mantenimiento-correo";
import { registrarEjecucion } from "@/lib/procesos-programados";

export const maxDuration = 300;

const DESTINOS = ["/admin/procesos", "/admin/correo"];

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await registrarEjecucion("mantenimiento-correo", "programado", null, () => ejecutarMantenimientoCorreo()));
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const pedido = String(form?.get("volver") ?? "");
  const volver = new URL(DESTINOS.includes(pedido) ? pedido : DESTINOS[0]!, req.url);
  if (pedido === "/admin/correo") volver.searchParams.set("tab", "mantenimiento");
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema ejecuta procesos.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    const r = await registrarEjecucion("mantenimiento-correo", "manual", session.userId, () => ejecutarMantenimientoCorreo());
    const partes: string[] = [];
    if (!("error" in r.cola)) partes.push(`cola: ${r.cola.enviados} enviado(s), ${r.cola.reprogramados} reprogramado(s), ${r.cola.fallidos + r.cola.caducados} descartado(s)`);
    if (!("error" in r.rebotes)) partes.push(`rebotes: ${r.rebotes.reduce((n, x) => n + x.marcados, 0)} envío(s) marcados, ${r.rebotes.reduce((n, x) => n + x.suprimidas, 0)} dirección(es) suprimidas`);
    if (!("error" in r.limpieza)) partes.push(`depuración: ${r.limpieza.registrosBorrados} registro(s) borrados`);
    if (!("error" in r.administrador)) partes.push(`administrador: ${r.administrador.correos} correo(s)`);
    volver.searchParams.set(r.ok ? "ok" : "error", `Mantenimiento del correo — ${partes.join("; ")}.`);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo ejecutar el proceso.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
