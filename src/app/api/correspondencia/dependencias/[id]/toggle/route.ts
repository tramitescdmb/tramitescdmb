import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/admin", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const dep = await db.dependencia.findUnique({ where: { id }, select: { activo: true, codigo: true } });
  if (!dep) {
    volver.searchParams.set("error", "La dependencia no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  await db.dependencia.update({ where: { id }, data: { activo: !dep.activo } });
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} ${dep.activo ? "desactivó" : "activó"} la dependencia ${dep.codigo}.`,
    usuarioId: session.userId,
  });
  volver.searchParams.set("ok", `Dependencia ${dep.codigo} ${dep.activo ? "desactivada" : "activada"}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
