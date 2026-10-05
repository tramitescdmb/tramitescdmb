import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { ETIQUETA_CORTA_ORIGEN, mensajeSoloEnModulo } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}#clasificacion`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteDocumental.findUnique({
    where: { id },
    select: {
      numero: true,
      estado: true,
      dependenciaId: true,
      origen: true,
      subserie: { select: { codigo: true, nombre: true } },
    },
  });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (expediente.origen !== "SGDEA") {
    await registrarAccesoDenegadoAccion(`reclasificar desde el SGDEA un expediente de ${ETIQUETA_CORTA_ORIGEN[expediente.origen]}`, id, session, req.headers);
    volver.searchParams.set("error", mensajeSoloEnModulo(expediente.origen));
    return NextResponse.redirect(volver, { status: 303 });
  }
  const archivo = puedeAdministrarArchivo(permisos);
  if (!archivo && !(expediente.estado === "ABIERTO" && puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId))) {
    await registrarAccesoDenegadoAccion("reclasificar la TRD del expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para reclasificar este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const subserieId = String(form.get("subserieId") || "");
  const motivo = String(form.get("motivo") || "").trim();
  if (!subserieId || !motivo) {
    volver.searchParams.set("error", "Elija la nueva subserie e indique el motivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const nueva = await db.subserieDocumental.findUnique({
    where: { id: subserieId },
    select: { id: true, codigo: true, nombre: true, activo: true, serieId: true, serie: { select: { activo: true, vigenteHasta: true } } },
  });
  if (!nueva || !nueva.activo || !nueva.serie.activo || nueva.serie.vigenteHasta) {
    volver.searchParams.set("error", "La subserie elegida no existe o no está vigente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await db.expedienteDocumental.update({ where: { id }, data: { serieId: nueva.serieId, subserieId: nueva.id } });

  const anterior = expediente.subserie ? `${expediente.subserie.codigo} — ${expediente.subserie.nombre}` : "sin clasificación";
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "CLASIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Reclasificó ${expediente.numero}: ${anterior} → ${nueva.codigo} — ${nueva.nombre}. Motivo: ${motivo}`,
  });

  volver.searchParams.set("ok", `${expediente.numero} reclasificado en ${nueva.codigo} — ${nueva.nombre}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
