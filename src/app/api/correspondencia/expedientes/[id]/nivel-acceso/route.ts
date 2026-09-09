import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { NivelAccesoInformacion } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { cambiarNivelAccesoExpediente } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const NIVELES_VALIDOS: NivelAccesoInformacion[] = ["PUBLICA", "CLASIFICADA", "RESERVADA"];

/** Cambia el nivel de acceso a la información de un expediente documental (Ley 1712/2014). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("cambiar el nivel de acceso del expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para cambiar el nivel de acceso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { numero: true } });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const nivelRaw = String(form.get("nivelAcceso") || "");
  const fundamento = String(form.get("fundamento") || "");
  if (!NIVELES_VALIDOS.includes(nivelRaw as NivelAccesoInformacion)) {
    volver.searchParams.set("error", "Nivel de acceso inválido.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const nivelAcceso = nivelRaw as NivelAccesoInformacion;

  let resultado: { anterior: NivelAccesoInformacion; nuevo: NivelAccesoInformacion };
  try {
    resultado = await cambiarNivelAccesoExpediente(id, nivelAcceso, fundamento);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo cambiar el nivel de acceso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "CLASIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Cambió el nivel de acceso de ${expediente.numero}: ${resultado.anterior} → ${resultado.nuevo}${fundamento.trim() ? ` — fundamento: ${fundamento.trim().slice(0, 300)}` : ""}`,
  });

  volver.searchParams.set("ok", `Nivel de acceso de ${expediente.numero} actualizado a ${resultado.nuevo}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
