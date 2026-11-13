import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { enviarCorreo, olvidarConfiguracionCorreo, plantillaCorreo } from "@/lib/correo-microsoft";
import { registrarAuditoria } from "@/lib/auditoria";
import { correoValido, escaparHtml, esClaveMatriz } from "@/lib/avisos-correo";
import { enviarPruebaAviso } from "@/lib/pruebas-avisos";
import { esClavePlantilla, limpiarHtml, plantillaDeEvento } from "@/lib/plantillas-correo-base";
import type { Borrador } from "@/lib/plantillas-correo";
import { partirClave, type ClaveMatriz } from "@/lib/avisos-correo";

const texto = (v: unknown) => (typeof v === "string" ? v : "");

function leerBorrador(clave: ClaveMatriz, valor: unknown): Borrador | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const b = valor as Record<string, unknown>;
  const borrador: Borrador = {};
  if (b.diseno && typeof b.diseno === "object") {
    const d = b.diseno as Record<string, unknown>;
    borrador.diseno = { antetitulo: texto(d.antetitulo), encabezado: limpiarHtml(texto(d.encabezado)), pie: limpiarHtml(texto(d.pie)) };
  }
  if (b.plantilla && typeof b.plantilla === "object") {
    const p = b.plantilla as Record<string, unknown>;
    const plantilla = texto(p.clave);
    if (!esClavePlantilla(plantilla) || plantilla !== plantillaDeEvento(partirClave(clave).evento, partirClave(clave).modulo)) return undefined;
    borrador.plantilla = { clave: plantilla, contenido: { asunto: texto(p.asunto), titulo: texto(p.titulo), cuerpo: limpiarHtml(texto(p.cuerpo)), boton: texto(p.boton) } };
  }
  return borrador.diseno || borrador.plantilla ? borrador : undefined;
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ ok: false, mensaje: "Solo el administrador del sistema prueba el correo." }, { status: 403 });
  const cuerpo = (await req.json().catch(() => ({}))) as { clave?: unknown; destino?: unknown; cuentaId?: unknown; borrador?: unknown };
  const clave = String(cuerpo.clave ?? "");
  const destino = String(cuerpo.destino ?? "").trim().replace(/[\s.,;]+$/, "").toLowerCase();
  if (!correoValido(destino)) return NextResponse.json({ ok: false, mensaje: "Indique un correo de prueba válido." }, { status: 400 });
  if (clave !== "conexion" && !esClaveMatriz(clave)) return NextResponse.json({ ok: false, mensaje: "Notificación desconocida." }, { status: 400 });
  const cuentaPedida = String(cuerpo.cuentaId ?? "").trim();
  const cuenta = cuentaPedida ? await db.cuentaCorreo.findUnique({ where: { id: cuentaPedida }, select: { id: true, nombre: true } }) : null;
  if (cuentaPedida && !cuenta) return NextResponse.json({ ok: false, mensaje: "La cuenta seleccionada no existe." }, { status: 400 });

  await db.configuracionSitio.upsert({ where: { id: "singleton" }, create: { id: "singleton", correoPruebaAvisos: destino }, update: { correoPruebaAvisos: destino } });

  if (clave === "conexion") {
    olvidarConfiguracionCorreo();
    const r = await enviarCorreo(
      {
        para: [destino],
        asunto: "Prueba de correo de la plataforma CDMB",
        html: plantillaCorreo("Correo de prueba", `<p>La plataforma envió este mensaje desde el correo institucional por solicitud de ${escaparHtml(session.nombre)}.</p>`),
      },
      cuenta?.id
    );
    if (cuenta) {
      await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { ultimaPruebaAt: new Date(), ultimaPruebaOk: r.ok, ultimaPruebaMensaje: r.ok ? `Enviado a ${destino}` : r.mensaje } });
    }
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `${session.nombre} ${r.ok ? "envió" : "intentó"} un correo de prueba a ${destino}${cuenta ? ` con la cuenta «${cuenta.nombre}»` : ""}${r.ok ? "." : `: ${r.mensaje}`}`,
      usuarioId: session.userId,
    });
    return NextResponse.json(r.ok ? { ok: true, mensaje: `Conexión correcta: correo enviado a ${destino}.` } : { ok: false, mensaje: r.mensaje });
  }

  const borrador = leerBorrador(clave as ClaveMatriz, cuerpo.borrador);
  const r = await enviarPruebaAviso(clave, destino, session.nombre, cuenta?.id, borrador).catch((err) => ({ ok: false, mensaje: err instanceof Error ? err.message : "No se pudo preparar la prueba." }));
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} ${r.ok ? "envió" : "intentó"} la prueba de la notificación ${clave} a ${destino}${r.ok ? "." : `: ${r.mensaje}`}`,
    usuarioId: session.userId,
  });
  return NextResponse.json(r);
}
