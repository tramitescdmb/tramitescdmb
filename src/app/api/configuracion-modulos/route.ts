import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { MODULOS_CONFIGURABLES, type CampoVisibilidadModulo } from "@/lib/modulos-visibles";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/admin/modulos", req.url);
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema puede cambiar esto.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const valores = Object.fromEntries(
    MODULOS_CONFIGURABLES.map((m) => [m.campo, form.get(m.campo) === "on"])
  ) as Record<CampoVisibilidadModulo, boolean>;

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...valores },
    update: valores,
  });

  const resumen = MODULOS_CONFIGURABLES.map((m) => `${m.nombre}: ${valores[m.campo] ? "visible" : "oculto"}`).join("; ");
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la disponibilidad de módulos para los funcionarios — ${resumen}.`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  volver.searchParams.set("ok", "Disponibilidad de módulos actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
