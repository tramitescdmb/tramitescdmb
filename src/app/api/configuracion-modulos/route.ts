import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

/** Disponibilidad de módulos para los funcionarios — reservada al administrador del SISTEMA (no a los
 * administradores de un módulo), porque decide qué módulos existen para el resto de la organización. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/admin/modulos", req.url);
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema puede cambiar esto.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const sgdeaVisibleFuncionarios = form.get("sgdeaVisibleFuncionarios") === "on";

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", sgdeaVisibleFuncionarios },
    update: { sgdeaVisibleFuncionarios },
  });

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la disponibilidad de módulos: SGDEA ${sgdeaVisibleFuncionarios ? "visible para los funcionarios" : "oculto (solo administradores)"}.`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  volver.searchParams.set("ok", "Disponibilidad de módulos actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
