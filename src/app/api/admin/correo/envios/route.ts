import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { procesarColaCorreo } from "@/lib/avisos-correo";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo?tab=envios", req.url);
  const salir = (tipo: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(tipo, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return salir("error", "Solo el administrador del sistema gestiona la cola de correo.");
  const accion = String((await req.formData()).get("accion") ?? "");
  const auditar = (descripcion: string) => registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} ${descripcion}`, usuarioId: session.userId });

  if (accion === "procesar") {
    const r = await procesarColaCorreo({ limite: 100, presupuestoMs: 240_000 });
    await auditar(`procesó la cola de correo: ${r.enviados} enviado(s), ${r.reprogramados} reprogramado(s), ${r.fallidos + r.caducados} descartado(s).`);
    return salir(r.motivo ? "error" : "ok", r.motivo ?? `Cola procesada: ${r.procesados} intento(s), ${r.enviados} enviado(s), ${r.reprogramados} reprogramado(s), ${r.fallidos + r.caducados} descartado(s), ${r.omitidos} omitido(s).`);
  }
  if (accion === "reintentar") {
    const r = await db.correoEnviado.updateMany({
      where: { estado: "FALLIDO", html: { not: null }, NOT: { clave: { startsWith: "prueba:" } } },
      data: { estado: "REINTENTO", intentos: 0, proximoIntento: new Date(), error: null },
    });
    if (r.count === 0) return salir("ok", "No hay envíos fallidos que puedan reintentarse.");
    const cola = await procesarColaCorreo({ limite: 100, presupuestoMs: 240_000 });
    await auditar(`reintentó ${r.count} correo(s) fallido(s): ${cola.enviados} enviado(s).`);
    return salir("ok", `${r.count} envío(s) vueltos a la cola: ${cola.enviados} enviado(s), ${cola.reprogramados} reprogramado(s), ${cola.fallidos} fallido(s).`);
  }
  if (accion === "descartar") {
    const r = await db.correoEnviado.updateMany({
      where: { estado: "REINTENTO" },
      data: { estado: "FALLIDO", error: `Descartado por ${session.nombre}.`, proximoIntento: null, html: null },
    });
    await auditar(`descartó ${r.count} correo(s) de la cola de reintentos.`);
    return salir("ok", `${r.count} envío(s) descartados de la cola.`);
  }
  return salir("error", "Acción no reconocida.");
}
