import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir, puedeSubdistribuirInternamente } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const ESTADOS_CERRADOS = ["RESPONDIDA", "ARCHIVADA", "ANULADA"];
const ETIQUETA_ESTADO_MIN: Record<string, string> = { RESPONDIDA: "respondida", ARCHIVADA: "archivada", ANULADA: "anulada" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const form = await req.formData();
  const dependenciaId = String(form.get("dependenciaId") || "") || null;
  // Puede repartirse a VARIOS funcionarios a la vez (<select multiple>).
  const usuarioIds = [...new Set(form.getAll("usuarioId").map((v) => String(v)).filter(Boolean))];
  const instrucciones = String(form.get("instrucciones") || "").trim() || null;
  const terminoRaw = Number(form.get("termino"));
  const termino = Number.isFinite(terminoRaw) && terminoRaw > 0 ? Math.floor(terminoRaw) : null;
  // Por defecto un reparto nuevo reemplaza al anterior; "sumar" lo mantiene y añade destinatarios.
  const sumar = form.get("sumar") === "on";

  const comunicacion = await db.comunicacion.findUnique({
    where: { id },
    select: {
      id: true,
      radicado: true,
      estado: true,
      dependenciaDestinoId: true,
      distribuciones: { where: { activa: true }, select: { id: true, usuarioId: true, dependenciaId: true } },
    },
  });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  // Dos formas de llegar aquí: el reparto centralizado (ventanilla/archivo/admin, a CUALQUIER
  // dependencia) o la sub-distribución de un jefe de dependencia dentro de SU PROPIA oficina, una
  // vez la comunicación ya le llegó (ver puedeSubdistribuirInternamente en permisos.ts).
  const esReparoCentralizado = puedeDistribuir(permisos);
  const esSubdistribucion =
    !esReparoCentralizado && puedeSubdistribuirInternamente(permisos, session.userId, comunicacion, comunicacion.distribuciones);
  if (!esReparoCentralizado && !esSubdistribucion) {
    await registrarAccesoDenegadoAccion("distribuir la comunicación", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para repartir esta comunicación.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (esSubdistribucion && dependenciaId && dependenciaId !== permisos.dependenciaId) {
    volver.searchParams.set("error", "Solo puede redistribuir dentro de su propia dependencia.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  if (ESTADOS_CERRADOS.includes(comunicacion.estado)) {
    volver.searchParams.set("error", `No se puede distribuir: ${comunicacion.radicado} ya quedó ${ETIQUETA_ESTADO_MIN[comunicacion.estado] ?? comunicacion.estado.toLowerCase()}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!dependenciaId && usuarioIds.length === 0) {
    volver.searchParams.set("error", "Elija al menos una dependencia o un funcionario.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const [dependencia, usuarios] = await Promise.all([
    dependenciaId ? db.dependencia.findUnique({ where: { id: dependenciaId }, select: { nombre: true } }) : null,
    usuarioIds.length
      ? db.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true, activo: true, rol: true, rolCorrespondencia: true, dependenciaId: true },
        })
      : [],
  ]);

  if (dependenciaId && !dependencia) {
    volver.searchParams.set("error", "La dependencia elegida no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (esSubdistribucion) {
    const fueraDeOficina = usuarios.filter((u) => u.dependenciaId !== permisos.dependenciaId);
    if (fueraDeOficina.length > 0) {
      volver.searchParams.set("error", "Solo puede redistribuir a colaboradores de su propia dependencia.");
      return NextResponse.redirect(volver, { status: 303 });
    }
  }
  const sinAcceso = usuarios.filter((u) => u.activo && u.rol !== "ADMIN" && !u.rolCorrespondencia);
  if (sinAcceso.length > 0) {
    volver.searchParams.set(
      "error",
      `${sinAcceso.map((u) => u.nombre).join(", ")} no tiene${sinAcceso.length > 1 ? "n" : ""} acceso al módulo de correspondencia — asígnele antes un rol desde Usuarios.`,
    );
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (usuarioIds.length > 0 && usuarios.length !== usuarioIds.length) {
    volver.searchParams.set("error", "Alguno de los funcionarios elegidos no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const yaVigentes = new Set(comunicacion.distribuciones.map((d) => d.usuarioId).filter(Boolean));
  const yaSoloDependencia = comunicacion.distribuciones.some((d) => !d.usuarioId && d.dependenciaId === dependenciaId);
  const nuevosUsuarios = usuarioIds.filter((uid) => !(sumar && yaVigentes.has(uid)));
  if (sumar && nuevosUsuarios.length === 0 && (!dependenciaId || yaSoloDependencia)) {
    volver.searchParams.set("error", "Esos destinatarios ya están en el reparto vigente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const filasNuevas =
    nuevosUsuarios.length > 0
      ? nuevosUsuarios.map((uid) => ({ comunicacionId: id, dependenciaId, usuarioId: uid, instrucciones, termino, asignadoPorId: session.userId }))
      : [{ comunicacionId: id, dependenciaId, usuarioId: null, instrucciones, termino, asignadoPorId: session.userId }];

  await db.$transaction([
    ...(sumar ? [] : [db.distribucion.updateMany({ where: { comunicacionId: id, activa: true }, data: { activa: false } })]),
    db.distribucion.createMany({ data: filasNuevas }),
    db.comunicacion.update({
      where: { id },
      data: { estado: "ASIGNADA", ...(dependenciaId ? { dependenciaDestinoId: dependenciaId } : {}) },
    }),
  ]);

  const nombresUsuarios = usuarios.filter((u) => nuevosUsuarios.includes(u.id)).map((u) => u.nombre);
  const destino = [dependencia?.nombre, nombresUsuarios.join(", ") || null].filter(Boolean).join(" · ");
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DISTRIBUYE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${sumar ? "Sumó al reparto de" : "Distribuyó"} ${comunicacion.radicado}: ${destino}${termino ? ` (término ${termino} días)` : ""}`,
  });

  volver.searchParams.set("ok", `${sumar ? "Añadido al reparto" : "Distribuida"}: ${destino}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
