import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  CLAVE_DISENO,
  definicionPlantilla,
  esClavePlantilla,
  limpiarHtml,
  validarDiseno,
  validarPlantilla,
} from "@/lib/plantillas-correo-base";
import { asegurarTablaPlantillas } from "@/lib/plantillas-correo";

type Respuesta = { ok: boolean; mensaje: string; errores?: string[] };

const responder = (r: Respuesta, status = 200) => NextResponse.json(r, { status });
const texto = (v: unknown) => (typeof v === "string" ? v : "");

async function autorizar() {
  const session = await getSession();
  return session?.rol === "ADMIN" ? session : null;
}

export async function POST(req: NextRequest) {
  const session = await autorizar();
  if (!session) return responder({ ok: false, mensaje: "Solo el administrador del sistema edita las plantillas de correo." }, 403);
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clave = texto(cuerpo.clave);
  await asegurarTablaPlantillas();

  if (clave === CLAVE_DISENO) {
    const diseno = { antetitulo: texto(cuerpo.antetitulo).trim(), encabezado: limpiarHtml(texto(cuerpo.encabezado)), pie: limpiarHtml(texto(cuerpo.pie)) };
    const v = validarDiseno(diseno);
    if (!v.ok) return responder({ ok: false, mensaje: "El diseño tiene errores.", errores: v.errores }, 400);
    const datos = { titulo: diseno.antetitulo, cuerpo: diseno.encabezado, pie: diseno.pie, actualizadoPor: session.nombre };
    await db.plantillaCorreo.upsert({ where: { clave }, create: { clave, ...datos }, update: datos });
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} actualizó el diseño general de los correos.`, usuarioId: session.userId });
    return responder({ ok: true, mensaje: "Diseño general guardado: se aplica a todos los correos desde ahora." });
  }

  if (!esClavePlantilla(clave)) return responder({ ok: false, mensaje: "Plantilla desconocida." }, 400);
  const contenido = { asunto: texto(cuerpo.asunto).trim(), titulo: texto(cuerpo.titulo).trim(), cuerpo: limpiarHtml(texto(cuerpo.cuerpo)), boton: texto(cuerpo.boton).trim() };
  const v = validarPlantilla(clave, contenido);
  if (!v.ok) return responder({ ok: false, mensaje: "La plantilla tiene errores.", errores: v.errores }, 400);
  const datos = { ...contenido, actualizadoPor: session.nombre };
  await db.plantillaCorreo.upsert({ where: { clave }, create: { clave, ...datos }, update: datos });
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la plantilla de correo «${definicionPlantilla(clave).nombre}» (${clave}).`,
    usuarioId: session.userId,
  });
  return responder({ ok: true, mensaje: "Plantilla guardada: los próximos correos salen con esta versión." });
}

export async function DELETE(req: NextRequest) {
  const session = await autorizar();
  if (!session) return responder({ ok: false, mensaje: "Solo el administrador del sistema edita las plantillas de correo." }, 403);
  const clave = req.nextUrl.searchParams.get("clave") ?? "";
  if (clave !== CLAVE_DISENO && !esClavePlantilla(clave)) return responder({ ok: false, mensaje: "Plantilla desconocida." }, 400);
  await asegurarTablaPlantillas();
  await db.plantillaCorreo.deleteMany({ where: { clave } });
  const nombre = clave === CLAVE_DISENO ? "el diseño general de los correos" : `la plantilla «${definicionPlantilla(clave).nombre}» (${clave})`;
  await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} restauró ${nombre} a la versión predeterminada.`, usuarioId: session.userId });
  return responder({ ok: true, mensaje: "Se restauró la versión predeterminada." });
}
