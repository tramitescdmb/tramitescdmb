import { NextRequest, NextResponse } from "next/server";
import type { ModalidadSeleccion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, puedeAsignarPersonalContrato } from "@/lib/permisos";
import { crearExpedienteContractual, ETIQUETA_MODALIDAD } from "@/lib/contratacion";

const MODALIDADES_VALIDAS = Object.keys(ETIQUETA_MODALIDAD) as ModalidadSeleccion[];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para crear expedientes de contratación." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const objeto = String(body.objeto || "").trim();
  const modalidadSeleccion = body.modalidadSeleccion as ModalidadSeleccion;
  const dependenciaSolicitanteId = String(body.dependenciaSolicitanteId || "").trim();

  if (!objeto) return NextResponse.json({ error: "El objeto del contrato es obligatorio." }, { status: 400 });
  if (!MODALIDADES_VALIDAS.includes(modalidadSeleccion)) {
    return NextResponse.json({ error: "Debe indicarse una modalidad de selección válida." }, { status: 400 });
  }
  if (!dependenciaSolicitanteId) return NextResponse.json({ error: "Debe indicarse la dependencia solicitante." }, { status: 400 });

  const dependencia = await db.dependencia.findUnique({ where: { id: dependenciaSolicitanteId }, select: { id: true } });
  if (!dependencia) return NextResponse.json({ error: "La dependencia seleccionada no existe." }, { status: 400 });

  const supervisorUsuarioIds: string[] = Array.isArray(body.supervisorUsuarioIds)
    ? body.supervisorUsuarioIds.filter((v: unknown): v is string => typeof v === "string" && v.trim() !== "")
    : [];

  const personalAsignadoIds: string[] = Array.isArray(body.personalAsignadoIds)
    ? [...new Set<string>(body.personalAsignadoIds.filter((v: unknown): v is string => typeof v === "string" && v.trim() !== ""))]
    : [];
  if (personalAsignadoIds.length > 0) {
    if (!puedeAsignarPersonalContrato(permisos)) {
      return NextResponse.json({ error: "No tiene permiso para asignar personal de contratación." }, { status: 403 });
    }
    const validos = await db.usuario.count({ where: { id: { in: personalAsignadoIds }, activo: true, rolContratacion: "FUNCIONARIO_CONTRATACION" } });
    if (validos !== personalAsignadoIds.length) {
      return NextResponse.json({ error: "Alguno de los usuarios elegidos no existe, está inactivo o no tiene el rol Personal de Contratación." }, { status: 400 });
    }
  }

  try {
    const expediente = await crearExpedienteContractual({
      objeto,
      modalidadSeleccion,
      valor: body.valor != null && body.valor !== "" ? Number(body.valor) : null,
      numeroContrato: typeof body.numeroContrato === "string" ? body.numeroContrato : null,
      numeroProcesoSecop: typeof body.numeroProcesoSecop === "string" ? body.numeroProcesoSecop : null,
      fechaSuscripcion: body.fechaSuscripcion ? new Date(body.fechaSuscripcion) : null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null,
      dependenciaSolicitanteId,
      contratistaId: body.contratistaId ? String(body.contratistaId) : null,
      supervisorUsuarioIds,
      personalAsignadoIds,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      creadoPorId: session.userId,
    });
    return NextResponse.json({ id: expediente.id, numero: expediente.numero }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo crear el expediente." }, { status: 400 });
  }
}
