import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import type { TipoActividadPaso } from "@prisma/client";
import { db } from "@/lib/db";
import { sesionEditorFormatos } from "@/lib/formatos-visita-api";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { ETIQUETA_TIPO_ACTIVIDAD, pasoPermiteVisita } from "@/lib/temas-visita";

const TIPOS = Object.keys(ETIQUETA_TIPO_ACTIVIDAD) as TipoActividadPaso[];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const paso = await db.pasoDefinicion.findUnique({
    where: { id },
    select: { id: true, numero: true, titulo: true, descripcion: true, tipoActividad: true, formatoVisitaId: true, flujo: { select: { nombre: true, tramiteTipo: { select: { codigo: true } } } } },
  });
  if (!paso) return NextResponse.json({ error: "Paso no encontrado." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { tipoActividad?: unknown; formatoVisitaId?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const tipoActividad = "tipoActividad" in body ? (TIPOS.includes(body.tipoActividad as TipoActividadPaso) ? (body.tipoActividad as TipoActividadPaso) : null) : paso.tipoActividad;
  let formatoVisitaId = "formatoVisitaId" in body ? (typeof body.formatoVisitaId === "string" && body.formatoVisitaId ? body.formatoVisitaId : null) : paso.formatoVisitaId;
  if (!pasoPermiteVisita(paso.titulo, paso.descripcion, tipoActividad)) formatoVisitaId = null;
  if (formatoVisitaId && !(await db.formatoVisita.findFirst({ where: { id: formatoVisitaId, activo: true }, select: { id: true } }))) {
    return NextResponse.json({ error: "El formato elegido no existe o está inactivo." }, { status: 400 });
  }

  await db.pasoDefinicion.update({ where: { id }, data: { tipoActividad, formatoVisitaId } });
  revalidateTag("tramites");

  const formato = formatoVisitaId ? await db.formatoVisita.findUnique({ where: { id: formatoVisitaId }, select: { nombre: true } }) : null;
  const { ip, userAgent } = datosPeticion(await headers());
  await registrarAuditoriaDoc({
    entidad: "PasoDefinicion",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: s.userId,
    ip,
    userAgent,
    detalle: `${s.nombre} configuró el paso ${paso.numero} (${paso.titulo}) de ${paso.flujo.tramiteTipo.codigo} · ${paso.flujo.nombre}: actividad ${tipoActividad ? ETIQUETA_TIPO_ACTIVIDAD[tipoActividad] : "automática"}${formato ? `, formato ${formato.nombre}` : ""}.`,
  });
  return NextResponse.json({ ok: true, tipoActividad, formatoVisitaId });
}
