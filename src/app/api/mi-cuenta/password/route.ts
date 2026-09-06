import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validarPoliticaPassword, passwordEnHistorial, registrarHistorialPassword, puedeCambiarPorVigenciaMinima } from "@/lib/password-policy";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Cambio de contraseña por el PROPIO usuario (MoReq 6.35) — a diferencia de
 * `PATCH /api/usuarios/[id]`, que restablece la contraseña de OTRO y solo un
 * ADMIN puede usar, esto lo puede usar cualquier cuenta autenticada sobre sí
 * misma, exige la contraseña actual, y respeta la vigencia mínima (esa regla
 * no aplica al restablecimiento por un administrador).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/mi-cuenta", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const usuario = await db.usuario.findUnique({ where: { id: session.userId } });
  if (!usuario) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (usuario.directorioActivo) {
    volver.searchParams.set("error", "Su contraseña se administra en el directorio activo de la CDMB, no aquí.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const actual = String(form.get("passwordActual") || "");
  const nueva = String(form.get("passwordNueva") || "");
  const confirmar = String(form.get("passwordConfirmar") || "");

  if (!actual || !nueva || !confirmar) {
    volver.searchParams.set("error", "Complete los tres campos.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!(await verifyPassword(actual, usuario.passwordHash))) {
    volver.searchParams.set("error", "La contraseña actual no es correcta.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (nueva !== confirmar) {
    volver.searchParams.set("error", "La contraseña nueva y su confirmación no coinciden.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const config = await getConfiguracionSitio();
  const vigenciaMinima = puedeCambiarPorVigenciaMinima(usuario.passwordCambiadaEn, config.passwordVigenciaMinimaDias);
  if (!vigenciaMinima.puede) {
    volver.searchParams.set(
      "error",
      `Ya cambió su contraseña recientemente. Podrá volver a cambiarla en ${vigenciaMinima.diasFaltantes} día(s).`
    );
    return NextResponse.redirect(volver, { status: 303 });
  }

  const errorPolitica = validarPoliticaPassword(nueva, config);
  if (errorPolitica) {
    volver.searchParams.set("error", errorPolitica);
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (await passwordEnHistorial(usuario.id, usuario.passwordHash, nueva, config.passwordHistorialCantidad)) {
    volver.searchParams.set(
      "error",
      `Ya usó esa contraseña antes. Elija una distinta a las últimas ${config.passwordHistorialCantidad}.`
    );
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarHistorialPassword(usuario.id, usuario.passwordHash, config.passwordHistorialCantidad);
  const passwordHash = await hashPassword(nueva);
  await db.usuario.update({ where: { id: usuario.id }, data: { passwordHash, passwordCambiadaEn: new Date() } });

  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${usuario.nombre} cambió su propia contraseña.`,
    usuarioId: usuario.id,
  });

  volver.searchParams.set("ok", "Contraseña actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
