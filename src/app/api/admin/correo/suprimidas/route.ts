import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { correoValido } from "@/lib/avisos-correo";

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo?tab=mantenimiento", req.url);
  const salir = (tipo: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(tipo, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return salir("error", "Solo el administrador del sistema gestiona la lista de supresión.");
  const form = await req.formData();
  const accion = String(form.get("accion") ?? "");
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  if (!correoValido(correo)) return salir("error", "El correo no es válido.");

  if (accion === "quitar") {
    const r = await db.correoSuprimido.deleteMany({ where: { correo } });
    if (r.count === 0) return salir("error", `${correo} no está en la lista de supresión.`);
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} quitó ${correo} de la lista de supresión del correo.`, usuarioId: session.userId });
    return salir("ok", `${correo} vuelve a recibir correos de la plataforma.`);
  }
  if (accion === "agregar") {
    const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300) || "Agregada por el administrador.";
    await db.correoSuprimido.upsert({ where: { correo }, create: { correo, motivo }, update: { motivo, ultimoEn: new Date() } });
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} agregó ${correo} a la lista de supresión del correo: ${motivo}`, usuarioId: session.userId });
    return salir("ok", `${correo} ya no recibirá correos de la plataforma.`);
  }
  return salir("error", "Acción no reconocida.");
}
