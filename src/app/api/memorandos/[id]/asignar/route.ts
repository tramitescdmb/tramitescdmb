import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos } from "@/lib/memorandos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const CERRADOS = ["RESPONDIDA", "ARCHIVADA", "ANULADA"];

/** Quien dirige la oficina destinataria asigna el memorando a un colaborador de su oficina para que proyecte la respuesta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const volver = new URL(`/memorandos/${id}`, req.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  const form = await req.formData();
  const usuarioId = String(form.get("usuarioId") || "");
  const instrucciones = String(form.get("instrucciones") || "").trim() || null;

  const memo = await db.comunicacion.findUnique({ where: { id }, select: { tipo: true, radicado: true, estado: true, dependenciaDestinoId: true } });
  if (!memo || memo.tipo !== "INTERNA") return NextResponse.redirect(new URL("/memorandos", req.url), { status: 303 });
  if (!ctx.firmante || !ctx.dependenciaId || ctx.dependenciaId !== memo.dependenciaDestinoId) {
    await registrarAccesoDenegadoAccion("asignar el memorando", id, session, req.headers);
    volver.searchParams.set("error", "Solo quien dirige la oficina destinataria puede asignar este memorando.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (CERRADOS.includes(memo.estado)) {
    volver.searchParams.set("error", "Este memorando ya está cerrado.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const u = usuarioId ? await db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true, activo: true, dependenciaId: true } }) : null;
  if (!u || !u.activo || u.dependenciaId !== ctx.dependenciaId) {
    volver.searchParams.set("error", "Elija una persona activa de su oficina.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await db.$transaction([
    db.distribucion.updateMany({ where: { comunicacionId: id, activa: true }, data: { activa: false } }),
    db.distribucion.create({ data: { comunicacionId: id, dependenciaId: ctx.dependenciaId, usuarioId, instrucciones, asignadoPorId: session.userId } }),
    db.comunicacion.update({ where: { id }, data: { estado: "ASIGNADA" } }),
  ]);
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DISTRIBUYE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Asignó el memorando ${memo.radicado} a ${u.nombre}`,
  });
  volver.searchParams.set("ok", `Asignado a ${u.nombre}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
