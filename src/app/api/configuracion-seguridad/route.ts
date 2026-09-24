import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarSigec } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

const RUTAS_DE_RETORNO = ["/admin/seguridad", "/contratacion/seguridad"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  const form = await req.formData();
  const destino = String(form.get("volver") || "");
  const volver = new URL(RUTAS_DE_RETORNO.includes(destino) ? destino : "/admin/seguridad", req.url);
  const permitido = session ? puedeAdministrarSigec(await obtenerPermisosUsuario(session.userId)) : false;
  if (!session || !permitido) {
    volver.searchParams.set("error", "Solo un administrador puede cambiar esto.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const tsaRaw = String(form.get("selloTiempoTsaUrl") || "").trim();
  const selloTiempoTsaUrl = /^https?:\/\/.+/i.test(tsaRaw) ? tsaRaw.slice(0, 300) : null;
  const maxIntentos = Math.min(20, Math.max(3, Number(form.get("loginMaxIntentos")) || 5));
  const ventanaMinutos = Math.min(120, Math.max(1, Number(form.get("loginVentanaMinutos")) || 15));

  const longitudMinima = Math.min(64, Math.max(6, Number(form.get("passwordLongitudMinima")) || 8));
  const longitudMaxima = Math.min(128, Math.max(longitudMinima, Number(form.get("passwordLongitudMaxima")) || 72));
  const requiereMayuscula = form.get("passwordRequiereMayuscula") === "on";
  const requiereNumero = form.get("passwordRequiereNumero") === "on";
  const requiereEspecial = form.get("passwordRequiereEspecial") === "on";
  const historialCantidad = Math.min(10, Math.max(0, Number(form.get("passwordHistorialCantidad")) || 0));
  const vigenciaRaw = Number(form.get("passwordVigenciaDias"));
  const vigenciaDias = vigenciaRaw > 0 ? Math.min(3650, vigenciaRaw) : null;
  const vigenciaMinimaDias = Math.min(365, Math.max(0, Math.floor(Number(form.get("passwordVigenciaMinimaDias")) || 0)));

  const EXTENSIONES_POR_DEFECTO = ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"];
  const extensionesTexto = String(form.get("extensionesPermitidas") || "");
  const extensionesPermitidas = Array.from(
    new Set(
      extensionesTexto
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase().replace(/^\./, "").replace(/[^a-z0-9]/g, ""))
        .filter(Boolean)
    )
  );
  const extensionesFinal = extensionesPermitidas.length > 0 ? extensionesPermitidas : EXTENSIONES_POR_DEFECTO;

  const datos = {
    selloTiempoTsaUrl,
    loginMaxIntentos: maxIntentos,
    loginVentanaMinutos: ventanaMinutos,
    passwordLongitudMinima: longitudMinima,
    passwordLongitudMaxima: longitudMaxima,
    passwordRequiereMayuscula: requiereMayuscula,
    passwordRequiereNumero: requiereNumero,
    passwordRequiereEspecial: requiereEspecial,
    passwordHistorialCantidad: historialCantidad,
    passwordVigenciaDias: vigenciaDias,
    passwordVigenciaMinimaDias: vigenciaMinimaDias,
    extensionesPermitidas: extensionesFinal,
  };

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...datos },
    update: datos,
  });

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó la política de seguridad: acceso ${maxIntentos} intentos/${ventanaMinutos} min; contraseña ${longitudMinima}-${longitudMaxima} caracteres, ${
      [requiereMayuscula && "mayúscula", requiereNumero && "número", requiereEspecial && "especial"].filter(Boolean).join("+") || "sin reglas de complejidad"
    }, histórico ${historialCantidad}, vigencia ${vigenciaDias ?? "sin vencimiento"} (mínima ${vigenciaMinimaDias || "sin mínimo"}); formatos permitidos: ${extensionesFinal.join(", ")}.`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  volver.searchParams.set("ok", "Configuración de seguridad actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
