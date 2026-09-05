import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import type { DisposicionFinal } from "@prisma/client";

const DISPOSICIONES: DisposicionFinal[] = ["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "MICROFILMACION_DIGITALIZACION"];

/** Crea una subserie dentro de una serie, con tiempos de retención y disposición final. */
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
  const serieId = String(form.get("serieId") || "");
  const codigo = String(form.get("codigo") || "").trim().toUpperCase();
  const nombre = String(form.get("nombre") || "").trim();
  const retencionGestionAnios = Math.max(0, Math.floor(Number(form.get("retencionGestionAnios")) || 0));
  const retencionCentralAnios = Math.max(0, Math.floor(Number(form.get("retencionCentralAnios")) || 0));
  const dispRaw = String(form.get("disposicionFinal") || "");
  const disposicionFinal = (DISPOSICIONES as string[]).includes(dispRaw) ? (dispRaw as DisposicionFinal) : null;

  const serie = serieId ? await db.serieDocumental.findUnique({ where: { id: serieId }, select: { codigo: true } }) : null;
  if (!serie || !codigo || !nombre) {
    volver.searchParams.set("error", "Serie, código y nombre de la subserie son obligatorios.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await db.subserieDocumental.create({
      data: { serieId, codigo, nombre, retencionGestionAnios, retencionCentralAnios, disposicionFinal },
    });
  } catch {
    volver.searchParams.set("error", `Ya existe la subserie ${codigo} en esa serie.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} creó la subserie ${serie.codigo}.${codigo} — ${nombre}.`,
    usuarioId: session.userId,
  });
  volver.searchParams.set("ok", `Subserie ${codigo} creada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
