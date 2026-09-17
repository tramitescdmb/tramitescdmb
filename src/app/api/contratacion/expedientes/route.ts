import { NextRequest, NextResponse } from "next/server";
import type { ModalidadSeleccion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";
import { crearExpedienteContractual, ETIQUETA_MODALIDAD } from "@/lib/contratacion";

const MODALIDADES_VALIDAS = Object.keys(ETIQUETA_MODALIDAD) as ModalidadSeleccion[];

/** Crea un expediente contractual — lo abre la Oficina de Contratación (Administrador de Contratación). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
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

  try {
    const expediente = await crearExpedienteContractual({
      objeto,
      modalidadSeleccion,
      valor: body.valor != null && body.valor !== "" ? Number(body.valor) : null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null,
      dependenciaSolicitanteId,
      contratistaId: body.contratistaId ? String(body.contratistaId) : null,
      supervisorUsuarioIds,
      creadoPorId: session.userId,
    });
    return NextResponse.json({ id: expediente.id, numero: expediente.numero }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo crear el expediente." }, { status: 400 });
  }
}
