import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

/** Parámetros de bloqueo de acceso por intentos fallidos (MoReq 6.12) — antes fijos en código. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/admin/seguridad", req.url);
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo un administrador puede cambiar esto.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const maxIntentos = Math.min(20, Math.max(3, Number(form.get("loginMaxIntentos")) || 5));
  const ventanaMinutos = Math.min(120, Math.max(1, Number(form.get("loginVentanaMinutos")) || 15));

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", loginMaxIntentos: maxIntentos, loginVentanaMinutos: ventanaMinutos },
    update: { loginMaxIntentos: maxIntentos, loginVentanaMinutos: ventanaMinutos },
  });

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} cambió el límite de acceso a ${maxIntentos} intentos fallidos por ${ventanaMinutos} minutos.`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  volver.searchParams.set("ok", "Configuración de seguridad actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
