import { NextRequest, NextResponse } from "next/server";
import type { ModalidadSeleccion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, puedeGestionarExpedienteCompleto, puedeEliminarExpedienteContractual } from "@/lib/permisos";
import { eliminarExpedienteContractualCompleto, registrarEventoContratacion, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import { deleteDocumento } from "@/lib/storage";

const MODALIDADES_VALIDAS = new Set(Object.keys(ETIQUETA_MODALIDAD));

/** Edita un expediente ya creado, en cualquier etapa. Cada bloque valida su propio permiso (no
 * hay un único gate al principio) porque, desde 2026-09-23, Funcionario de Contratación también
 * puede editar los datos generales (modalidad/valor/dependencia/número de contrato/contratista)
 * pero NO gestiona supervisores ni el expediente relacionado — eso sigue siendo exclusivo de
 * Administrador/Jefe (`puedeGestionarContratistas`). El contratista vinculado (si tiene cuenta de
 * acceso) es quien consulta el expediente y carga documentos desde la etapa Contractual. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  if ("contratistaId" in body) {
    if (!puedeGestionarExpedienteCompleto(permisos)) {
      return NextResponse.json({ error: "No tiene permiso para vincular el contratista de este expediente." }, { status: 403 });
    }
    const contratistaId = String(body.contratistaId || "").trim();
    if (!contratistaId) return NextResponse.json({ error: "Falta el contratista." }, { status: 400 });
    const [contratista, actual] = await Promise.all([
      db.contratista.findUnique({ where: { id: contratistaId }, select: { nombreORazonSocial: true } }),
      db.expedienteContractual.findUnique({ where: { id }, select: { contratista: { select: { id: true, nombreORazonSocial: true } } } }),
    ]);
    if (!contratista) return NextResponse.json({ error: "El contratista no existe." }, { status: 404 });
    if (!actual) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
    if (actual.contratista && actual.contratista.id === contratistaId) {
      return NextResponse.json({ error: "Ese ya es el contratista vinculado a este expediente." }, { status: 409 });
    }

    // Antes la norma era "un contratista por expediente, nunca se reemplaza" — pedido explícito
    // del usuario (2026-09-23): administrador/jefe/funcionario de Contratación ahora SÍ pueden
    // cambiarlo (un error de captura al vincular ya no exige eliminar el expediente completo). La
    // condición `contratistaId: actual.contratista?.id ?? null` en el WHERE evita que dos personas
    // lo cambien a la vez y una pise a la otra.
    const { count } = await db.expedienteContractual.updateMany({
      where: { id, contratistaId: actual.contratista?.id ?? null },
      data: { contratistaId },
    });
    if (count === 0) return NextResponse.json({ error: "El contratista de este expediente acaba de cambiar; no se modificó." }, { status: 409 });
    await registrarEventoContratacion(
      id,
      "CONTRATISTA_VINCULADO",
      actual.contratista
        ? `Se cambió el contratista de ${actual.contratista.nombreORazonSocial} a ${contratista.nombreORazonSocial}.`
        : `Se vinculó a ${contratista.nombreORazonSocial} como contratista.`,
      session.userId
    );
    return NextResponse.json({ ok: true });
  }

  if (
    "numeroContrato" in body ||
    "fechaInicio" in body ||
    "fechaFinEstimada" in body ||
    "modalidadSeleccion" in body ||
    "valor" in body ||
    "dependenciaSolicitanteId" in body
  ) {
    if (!puedeGestionarExpedienteCompleto(permisos)) {
      return NextResponse.json({ error: "No tiene permiso para editar los datos generales de este expediente." }, { status: 403 });
    }
    if ("modalidadSeleccion" in body && !MODALIDADES_VALIDAS.has(String(body.modalidadSeleccion))) {
      return NextResponse.json({ error: "La modalidad de selección indicada no es válida." }, { status: 400 });
    }
    if ("dependenciaSolicitanteId" in body) {
      const dependenciaId = String(body.dependenciaSolicitanteId || "").trim();
      if (!dependenciaId) return NextResponse.json({ error: "Debe elegir la dependencia solicitante." }, { status: 400 });
      const dependencia = await db.dependencia.findUnique({ where: { id: dependenciaId }, select: { id: true } });
      if (!dependencia) return NextResponse.json({ error: "La dependencia indicada no existe." }, { status: 404 });
    }
    // Ajuste formal a las fechas reales del Acta de Inicio, el número real del contrato (SECOP II,
    // a menudo no se conoce aún al abrir el expediente en Precontractual) y, desde 2026-09-23, los
    // datos generales que antes solo se fijaban al crear el expediente (modalidad/valor/dependencia).
    await db.expedienteContractual.update({
      where: { id },
      data: {
        ...("numeroContrato" in body ? { numeroContrato: body.numeroContrato ? String(body.numeroContrato).trim() : null } : {}),
        ...("fechaInicio" in body ? { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null } : {}),
        ...("fechaFinEstimada" in body ? { fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null } : {}),
        ...("modalidadSeleccion" in body ? { modalidadSeleccion: body.modalidadSeleccion as ModalidadSeleccion } : {}),
        ...("valor" in body ? { valor: body.valor === null || body.valor === "" ? null : Number(body.valor) } : {}),
        ...("dependenciaSolicitanteId" in body ? { dependenciaSolicitanteId: String(body.dependenciaSolicitanteId).trim() } : {}),
      },
    });
    await registrarEventoContratacion(id, "DATOS_CONTRATO_ACTUALIZADOS", "Se actualizaron los datos generales del expediente.", session.userId);
    return NextResponse.json({ ok: true });
  }

  if ("supervisorUsuarioIds" in body) {
    if (!puedeGestionarContratistas(permisos)) {
      return NextResponse.json({ error: "No tiene permiso para editar los supervisores de este expediente." }, { status: 403 });
    }
    const idsBody: unknown = body.supervisorUsuarioIds;
    const supervisorUsuarioIds = Array.isArray(idsBody) ? [...new Set(idsBody.filter((v): v is string => typeof v === "string" && v.trim() !== ""))] : [];
    if (supervisorUsuarioIds.length > 0) {
      const usuarios = await db.usuario.findMany({ where: { id: { in: supervisorUsuarioIds }, activo: true }, select: { id: true } });
      if (usuarios.length !== supervisorUsuarioIds.length) {
        return NextResponse.json({ error: "Alguno de los usuarios elegidos no existe o está inactivo." }, { status: 400 });
      }
    }
    await db.$transaction([
      db.expedienteContractualSupervisor.deleteMany({ where: { expedienteId: id } }),
      ...(supervisorUsuarioIds.length > 0
        ? [db.expedienteContractualSupervisor.createMany({ data: supervisorUsuarioIds.map((usuarioId) => ({ expedienteId: id, usuarioId })) })]
        : []),
    ]);
    await registrarEventoContratacion(id, "SUPERVISORES_ACTUALIZADOS", `Se actualizó la lista de supervisor(es)/interventor(es) (${supervisorUsuarioIds.length}).`, session.userId);
    return NextResponse.json({ ok: true });
  }

  if ("expedienteRelacionadoId" in body) {
    if (!puedeGestionarContratistas(permisos)) {
      return NextResponse.json({ error: "No tiene permiso para relacionar este expediente con otro." }, { status: 403 });
    }
    const expedienteRelacionadoId = body.expedienteRelacionadoId ? String(body.expedienteRelacionadoId).trim() : null;
    if (expedienteRelacionadoId === id) return NextResponse.json({ error: "Un expediente no puede relacionarse consigo mismo." }, { status: 400 });
    let relacionado: { numero: string } | null = null;
    if (expedienteRelacionadoId) {
      relacionado = await db.expedienteContractual.findUnique({ where: { id: expedienteRelacionadoId }, select: { numero: true } });
      if (!relacionado) return NextResponse.json({ error: "El expediente relacionado no existe." }, { status: 404 });
    }
    await db.expedienteContractual.update({ where: { id }, data: { expedienteRelacionadoId } });
    await registrarEventoContratacion(
      id,
      "EXPEDIENTE_RELACIONADO",
      relacionado ? `Se vinculó como relacionado el expediente ${relacionado.numero}.` : "Se quitó la vinculación con otro expediente.",
      session.userId
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
}

/** Elimina COMPLETAMENTE un expediente contractual, incluso cerrado — decisión explícita
 * del usuario, más severa que la excepción de borrado de un solo documento. Reservado al
 * Administrador de Contratación. Los archivos del storage se borran best-effort. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEliminarExpedienteContractual(permisos)) {
    return NextResponse.json({ error: "Solo el Administrador de Contratación puede eliminar un expediente." }, { status: 403 });
  }

  try {
    const { storagePaths } = await eliminarExpedienteContractualCompleto(id);
    await Promise.all(storagePaths.map((p) => deleteDocumento(p).catch(() => {})));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar el expediente." }, { status: 400 });
  }
}
