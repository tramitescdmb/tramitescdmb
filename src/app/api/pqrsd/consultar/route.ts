import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { ETIQUETA_TIPO_PQRSD } from "@/lib/pqrsd";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignada",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Se le solicitó información adicional",
  RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada",
  ANULADA: "Anulada",
};

/**
 * Consulta pública de estado (sin sesión): exige radicado E identificación —
 * el radicado solo no basta, para no permitir enumerar solicitudes ajenas.
 * Ante cualquier desajuste responde el mismo genérico "no encontrado", sin
 * distinguir cuál de los dos datos falló.
 */
export async function POST(req: NextRequest) {
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "pqrsd:consultar", { porHora: 15, porDia: 60 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const radicado = String(body?.radicado ?? "").trim().toUpperCase();
  const identificacion = String(body?.identificacion ?? "").trim();
  if (!radicado || !identificacion) {
    return NextResponse.json({ error: "Indique el radicado y la identificación con la que se radicó." }, { status: 400 });
  }

  const c = await db.comunicacion.findFirst({
    where: { radicado, terceroIdentificacion: identificacion },
    select: {
      id: true,
      radicado: true,
      asunto: true,
      estado: true,
      tipoPqrsd: true,
      fechaRadicacion: true,
      fechaVencimiento: true,
    },
  });

  if (!c) {
    return NextResponse.json({ error: "No se encontró ninguna solicitud con ese radicado e identificación." }, { status: 404 });
  }

  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: c.id,
    accion: "LEE",
    usuarioId: null,
    ip,
    userAgent,
    detalle: `Consulta pública de estado de ${c.radicado}`,
  });

  return NextResponse.json({
    radicado: c.radicado,
    asunto: c.asunto,
    estado: ETIQUETA_ESTADO[c.estado] ?? c.estado,
    tipo: c.tipoPqrsd ? ETIQUETA_TIPO_PQRSD[c.tipoPqrsd] : null,
    fechaRadicacion: c.fechaRadicacion,
    fechaVencimiento: c.fechaVencimiento,
  });
}
