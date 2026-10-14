import { errorCombinacionContrato, esCausalContratacionDirecta } from "@/lib/compatibilidad-modalidad";
import { NextRequest, NextResponse } from "next/server";
import { esTipoContrato } from "@/lib/tipo-contrato";
import type { ModalidadSeleccion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeCrearExpedienteContractual, puedeAsignarPersonalContrato, tieneRolContratacion } from "@/lib/permisos";
import { sincronizarExpedienteSecop, asegurarContratistaDeUsuario, crearExpedienteContractual, ETIQUETA_MODALIDAD } from "@/lib/contratacion";

const MODALIDADES_VALIDAS = Object.keys(ETIQUETA_MODALIDAD) as ModalidadSeleccion[];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeCrearExpedienteContractual(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para crear expedientes de contratación." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const objeto = String(body.objeto || "").trim();
  const modalidadSeleccion = body.modalidadSeleccion as ModalidadSeleccion;
  const dependenciaSolicitanteId = String(body.dependenciaSolicitanteId || "").trim();

  if (!esTipoContrato(body.tipoContrato)) {
    return NextResponse.json({ error: "Seleccione el tipo de contrato." }, { status: 400 });
  }
  if (!MODALIDADES_VALIDAS.includes(modalidadSeleccion)) {
    return NextResponse.json({ error: "Debe indicarse una modalidad de selección válida." }, { status: 400 });
  }
  if (!dependenciaSolicitanteId) return NextResponse.json({ error: "Debe indicarse la dependencia solicitante." }, { status: 400 });
  const combinacion = errorCombinacionContrato(modalidadSeleccion, body.tipoContrato, body.causalContratacionDirecta);
  if (combinacion) return NextResponse.json({ error: combinacion }, { status: 400 });

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
    const validos = await db.usuario.count({ where: { id: { in: personalAsignadoIds }, activo: true, rolesContratacion: { has: "FUNCIONARIO_CONTRATACION" } } });
    if (validos !== personalAsignadoIds.length) {
      return NextResponse.json({ error: "Alguno de los usuarios elegidos no existe, está inactivo o no tiene el rol Personal de Contratación." }, { status: 400 });
    }
  }

  try {
    const contratistaUsuarioId = typeof body.contratistaUsuarioId === "string" ? body.contratistaUsuarioId.trim() : "";
    let contratistaId = typeof body.contratistaId === "string" ? body.contratistaId.trim() || null : null;
    if (contratistaUsuarioId) {
      contratistaId = (await asegurarContratistaDeUsuario(contratistaUsuarioId)).id;
    }
    const expediente = await crearExpedienteContractual({
      objeto,
      modalidadSeleccion,
      tipoContrato: body.tipoContrato,
      causalContratacionDirecta: esCausalContratacionDirecta(body.causalContratacionDirecta) ? body.causalContratacionDirecta : null,
      codigoProceso: typeof body.codigoProceso === "string" ? body.codigoProceso : null,
      idContratoSecop: typeof body.idContratoSecop === "string" && body.idContratoSecop.trim() ? body.idContratoSecop.trim() : null,
      valor: body.valor != null && body.valor !== "" ? Number(body.valor) : null,
      numeroContrato: typeof body.numeroContrato === "string" ? body.numeroContrato : null,
      numeroProcesoSecop: typeof body.numeroProcesoSecop === "string" ? body.numeroProcesoSecop : null,
      fechaSuscripcion: body.fechaSuscripcion ? new Date(body.fechaSuscripcion) : null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null,
      dependenciaSolicitanteId,
      contratistaId,
      supervisorUsuarioIds,
      personalAsignadoIds:
        !puedeAsignarPersonalContrato(permisos) && tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION")
          ? [...new Set([...personalAsignadoIds, session.userId])]
          : personalAsignadoIds,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      creadoPorId: session.userId,
    });
    if (expediente.idContratoSecop) {
      await sincronizarExpedienteSecop(expediente.id, session.userId).catch(() => null);
    }
    return NextResponse.json({ id: expediente.id, numero: expediente.numero }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo crear el expediente." }, { status: 400 });
  }
}
