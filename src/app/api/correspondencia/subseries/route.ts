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
  const disposicionesFinal = form
    .getAll("disposicionesFinal")
    .map((v) => String(v))
    .filter((v): v is DisposicionFinal => (DISPOSICIONES as string[]).includes(v));

  const serie = serieId ? await db.serieDocumental.findUnique({ where: { id: serieId }, select: { codigo: true } }) : null;
  if (!serie || !codigo || !nombre) {
    volver.searchParams.set("error", "Serie, código y nombre de la subserie son obligatorios.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await db.subserieDocumental.create({
      data: { serieId, codigo, nombre, retencionGestionAnios, retencionCentralAnios, disposicionesFinal },
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

/**
 * Cambia retención y/o disposición final de VARIAS subseries a la vez, aunque
 * sean de series o dependencias distintas (MoReq 1.39: "modificar tiempos de
 * retención para un conjunto de series/expedientes"). Antes solo se podía
 * corregir una subserie repitiendo toda la TRD por CSV; esto edita en el
 * sitio. Cada campo omitido en el body se deja sin tocar.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para administrar las TRD." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const subserieIds: string[] = Array.isArray(body?.subserieIds)
    ? body.subserieIds.filter((v: unknown): v is string => typeof v === "string")
    : [];
  if (subserieIds.length === 0) {
    return NextResponse.json({ error: "No hay subseries seleccionadas." }, { status: 400 });
  }

  const data: { retencionGestionAnios?: number; retencionCentralAnios?: number; disposicionesFinal?: DisposicionFinal[] } = {};
  if (typeof body?.retencionGestionAnios === "number" && Number.isFinite(body.retencionGestionAnios)) {
    data.retencionGestionAnios = Math.max(0, Math.floor(body.retencionGestionAnios));
  }
  if (typeof body?.retencionCentralAnios === "number" && Number.isFinite(body.retencionCentralAnios)) {
    data.retencionCentralAnios = Math.max(0, Math.floor(body.retencionCentralAnios));
  }
  if (Array.isArray(body?.disposicionesFinal)) {
    data.disposicionesFinal = body.disposicionesFinal.filter(
      (v: unknown): v is DisposicionFinal => (DISPOSICIONES as string[]).includes(v as string)
    );
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No se indicó ningún cambio a aplicar." }, { status: 400 });
  }

  const resultado = await db.subserieDocumental.updateMany({ where: { id: { in: subserieIds } }, data });

  const cambios = [
    data.retencionGestionAnios !== undefined && `gestión→${data.retencionGestionAnios}a`,
    data.retencionCentralAnios !== undefined && `central→${data.retencionCentralAnios}a`,
    data.disposicionesFinal !== undefined && `disposición→${data.disposicionesFinal.join("+") || "ninguna"}`,
  ]
    .filter(Boolean)
    .join(", ");
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó ${resultado.count} subserie(s) en lote: ${cambios}.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true, actualizadas: resultado.count });
}
