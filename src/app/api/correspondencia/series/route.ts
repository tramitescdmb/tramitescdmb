import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

/** Crea una serie documental (TRD). Versión "1" por defecto. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar las TRD.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const codigo = String(form.get("codigo") || "").trim().toUpperCase();
  const nombre = String(form.get("nombre") || "").trim();
  const version = String(form.get("version") || "1").trim() || "1";
  const dependenciaId = String(form.get("dependenciaId") || "") || null;

  if (!codigo || !nombre) {
    volver.searchParams.set("error", "Código y nombre de la serie son obligatorios.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await db.serieDocumental.create({ data: { codigo, nombre, version, dependenciaId } });
  } catch {
    volver.searchParams.set("error", `Ya existe la serie ${codigo} versión ${version}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} creó la serie documental ${codigo} (v${version}) — ${nombre}.`,
    usuarioId: session.userId,
  });
  volver.searchParams.set("ok", `Serie ${codigo} creada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
