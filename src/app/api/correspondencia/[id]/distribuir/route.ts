import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const ESTADOS_CERRADOS = ["RESPONDIDA", "ARCHIVADA", "ANULADA"];
const ETIQUETA_ESTADO_MIN: Record<string, string> = { RESPONDIDA: "respondida", ARCHIVADA: "archivada", ANULADA: "anulada" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    await registrarAccesoDenegadoAccion("distribuir la comunicación", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para distribuir.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const dependenciaId = String(form.get("dependenciaId") || "") || null;
  const usuarioId = String(form.get("usuarioId") || "") || null;
  const instrucciones = String(form.get("instrucciones") || "").trim() || null;
  const terminoRaw = Number(form.get("termino"));
  const termino = Number.isFinite(terminoRaw) && terminoRaw > 0 ? Math.floor(terminoRaw) : null;

  const comunicacion = await db.comunicacion.findUnique({
    where: { id },
    select: {
      id: true,
      radicado: true,
      estado: true,
      distribuciones: { orderBy: { fechaAsignacion: "desc" }, take: 1, select: { usuarioId: true, dependenciaId: true } },
    },
  });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  // Ya cerró su ciclo — distribuirla de nuevo pisaría ese cierre (ej. una RESPONDIDA volvía a
  // ASIGNADA si alguien la distribuía otra vez, sin que nada avisara del retroceso).
  if (ESTADOS_CERRADOS.includes(comunicacion.estado)) {
    volver.searchParams.set("error", `No se puede distribuir: ${comunicacion.radicado} ya quedó ${ETIQUETA_ESTADO_MIN[comunicacion.estado] ?? comunicacion.estado.toLowerCase()}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!dependenciaId && !usuarioId) {
    volver.searchParams.set("error", "Elija al menos una dependencia o un funcionario.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const [dependencia, usuario] = await Promise.all([
    dependenciaId ? db.dependencia.findUnique({ where: { id: dependenciaId }, select: { nombre: true } }) : null,
    usuarioId ? db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true, activo: true, rol: true, rolCorrespondencia: true } }) : null,
  ]);

  if (usuarioId && !usuario) {
    volver.searchParams.set("error", "El funcionario elegido no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  // No tiene sentido asignarla a alguien que ni siquiera puede entrar al módulo — quedaría
  // "asignada" a una persona que nunca podrá verla ni responderla.
  if (usuario && usuario.activo && usuario.rol !== "ADMIN" && !usuario.rolCorrespondencia) {
    volver.searchParams.set("error", `${usuario.nombre} no tiene acceso al módulo de correspondencia — asígnele antes un rol desde su ficha en Usuarios.`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  const vigente = comunicacion.distribuciones[0];
  if (usuarioId && vigente?.usuarioId === usuarioId) {
    volver.searchParams.set("error", `Ya está asignada actualmente a ${usuario?.nombre ?? "esa persona"}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!usuarioId && dependenciaId && !vigente?.usuarioId && vigente?.dependenciaId === dependenciaId) {
    volver.searchParams.set("error", `Ya está asignada actualmente a ${dependencia?.nombre ?? "esa dependencia"}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

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
