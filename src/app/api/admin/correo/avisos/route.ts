import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { EVENTOS_AVISO, esEventoAviso, type EventoAviso } from "@/lib/avisos-correo";

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo", req.url);
  const salir = (tipo: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(tipo, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return salir("error", "Solo el administrador del sistema configura las notificaciones.");

  const form = await req.formData();
  const accion = String(form.get("accion") ?? "");
  const todos = Object.keys(EVENTOS_AVISO) as EventoAviso[];
  const activos = new Set(accion === "todos" ? todos : accion === "ninguno" ? [] : form.getAll("evento").map(String).filter(esEventoAviso));
  const desactivados = todos.filter((e) => !activos.has(e));
  const url = String(form.get("urlPlataforma") ?? "").trim().replace(/\/+$/, "");
  if (url && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return salir("error", "La dirección de la plataforma debe empezar por https:// y ser un dominio válido.");

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", avisosCorreoDesactivados: desactivados, urlPlataforma: url || null },
    update: { avisosCorreoDesactivados: desactivados, urlPlataforma: url || null },
  });
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la matriz de notificaciones por correo: ${activos.size} de ${Object.keys(EVENTOS_AVISO).length} eventos activos${
      desactivados.length ? ` (desactivados: ${desactivados.join(", ")})` : ""
    }.`,
    usuarioId: session.userId,
  });
  return salir("ok", `Matriz de notificaciones guardada: ${activos.size} de ${todos.length} eventos se envían por correo.`);
}
