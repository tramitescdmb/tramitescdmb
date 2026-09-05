import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para distribuir.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const dependenciaId = String(form.get("dependenciaId") || "") || null;
  const usuarioId = String(form.get("usuarioId") || "") || null;
  const instrucciones = String(form.get("instrucciones") || "").trim() || null;
  const terminoRaw = Number(form.get("termino"));
  const termino = Number.isFinite(terminoRaw) && terminoRaw > 0 ? Math.floor(terminoRaw) : null;

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { id: true, radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!dependenciaId && !usuarioId) {
    volver.searchParams.set("error", "Elija al menos una dependencia o un funcionario.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const [dependencia, usuario] = await Promise.all([
    dependenciaId ? db.dependencia.findUnique({ where: { id: dependenciaId }, select: { nombre: true } }) : null,
    usuarioId ? db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }) : null,
  ]);

  await db.$transaction([
    db.distribucion.create({
      data: { comunicacionId: id, dependenciaId, usuarioId, instrucciones, termino, asignadoPorId: session.userId },
    }),
    db.comunicacion.update({
      where: { id },
      data: { estado: "ASIGNADA", ...(dependenciaId ? { dependenciaDestinoId: dependenciaId } : {}) },
    }),
  ]);

  const destino = [dependencia?.nombre, usuario?.nombre].filter(Boolean).join(" · ");
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DISTRIBUYE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Distribuyó ${comunicacion.radicado} a ${destino}${termino ? ` (término ${termino} días)` : ""}`,
  });

  volver.searchParams.set("ok", `Distribuida a ${destino}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
