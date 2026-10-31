import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo", req.url);
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema prueba el correo.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const form = await req.formData();
  const destino = String(form.get("destino") || "").trim().toLowerCase();
  const cuentaId = String(form.get("cuentaId") || "").trim() || undefined;
  const usuario = await db.usuario.findUnique({ where: { id: session.userId }, select: { correoNotificacion: true } });
  const para = destino || usuario?.correoNotificacion || "";
  const cuenta = cuentaId ? await db.cuentaCorreo.findUnique({ where: { id: cuentaId }, select: { id: true, nombre: true } }) : null;
  const r = await enviarCorreo(
    {
      para: [para],
      asunto: "Prueba de correo de la plataforma CDMB",
      html: plantillaCorreo("Correo de prueba", `<p>La plataforma envió este mensaje desde el correo institucional por solicitud de ${session.nombre}.</p>`),
    },
    cuenta?.id
  );
  if (cuenta) {
    await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { ultimaPruebaAt: new Date(), ultimaPruebaOk: r.ok, ultimaPruebaMensaje: r.ok ? `Enviado a ${para}` : r.mensaje } });
  }
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} ${r.ok ? "envió" : "intentó"} un correo de prueba a ${para}${cuenta ? ` con la cuenta «${cuenta.nombre}»` : ""}${r.ok ? "." : `: ${r.mensaje}`}`,
    usuarioId: session.userId,
  });
  volver.searchParams.set(r.ok ? "ok" : "error", r.ok ? `Correo de prueba enviado a ${para}.` : r.mensaje);
  return NextResponse.redirect(volver, { status: 303 });
}
