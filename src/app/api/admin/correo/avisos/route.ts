import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { CLAVES_MATRIZ, correoValido, esClaveMatriz } from "@/lib/avisos-correo";

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo", req.url);
  const salir = (tipo: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(tipo, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return salir("error", "Solo el administrador del sistema configura las notificaciones.");

  const form = await req.formData();
  const elegidos = new Set(form.getAll("evento").map(String).filter(esClaveMatriz));
  const activos = CLAVES_MATRIZ.filter((c) => elegidos.has(c));
  const url = String(form.get("urlPlataforma") ?? "").trim().replace(/\/+$/, "");
  if (url && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return salir("error", "La dirección de la plataforma debe empezar por https:// y ser un dominio válido.");
  const correoPrueba = String(form.get("correoPrueba") ?? "").trim().toLowerCase();
  if (correoPrueba && !correoValido(correoPrueba)) return salir("error", "El correo de prueba no es válido.");

  const previo = await db.configuracionSitio.findUnique({ where: { id: "singleton" }, select: { avisosCorreoActivos: true } });
  const antes = new Set(previo?.avisosCorreoActivos ?? []);
  const encendidos = activos.filter((c) => !antes.has(c));
  const apagados = [...antes].filter((c) => !(activos as string[]).includes(c));
  const datos = { avisosCorreoActivos: activos, urlPlataforma: url || null, correoPruebaAvisos: correoPrueba || null };
  await db.configuracionSitio.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...datos }, update: datos });
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la matriz de notificaciones por correo: ${activos.length} de ${CLAVES_MATRIZ.length} activas${
      encendidos.length ? `; encendió ${encendidos.join(", ")}` : ""
    }${apagados.length ? `; apagó ${apagados.join(", ")}` : ""}.`,
    usuarioId: session.userId,
  });
  return salir("ok", `Matriz de notificaciones guardada: ${activos.length} de ${CLAVES_MATRIZ.length} se envían por correo.`);
}
