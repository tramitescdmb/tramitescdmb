import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const codigo = String(form.get("codigo") || "").trim().toUpperCase();
  const nombre = String(form.get("nombre") || "").trim();
  const parentId = String(form.get("parentId") || "") || null;

  if (!codigo || !nombre) {
    volver.searchParams.set("error", "Código y nombre de la dependencia son obligatorios.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const parent = parentId ? await db.dependencia.findUnique({ where: { id: parentId }, select: { nivel: true } }) : null;
  const nivel = parent ? parent.nivel + 1 : 0;

  try {
    await db.dependencia.create({ data: { codigo, nombre, parentId, nivel } });
  } catch {
    volver.searchParams.set("error", `Ya existe una dependencia con el código ${codigo}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} creó la dependencia ${codigo} — ${nombre}.`,
    usuarioId: session.userId,
  });
  volver.searchParams.set("ok", `Dependencia ${codigo} creada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
