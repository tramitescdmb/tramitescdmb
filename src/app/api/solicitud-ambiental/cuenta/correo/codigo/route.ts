import { NextRequest, NextResponse } from "next/server";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";
import { normalizarCorreo, origenPermitido } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion, solicitarCambioCorreo } from "@/lib/cuenta-ciudadana-db";

const MENSAJE = "Si el correo puede usarse, le llegará un código en unos minutos. Revise también la carpeta de correo no deseado.";

/**
 * Pide el código para cambiar el correo de la cuenta. Se envía al correo NUEVO; la respuesta es la
 * misma esté o no ocupado ese correo por otra cuenta (no se revela).
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:correo-codigo", { porHora: 6, porDia: 15 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const correo = normalizarCorreo(body?.correo);
  if (!correo) return NextResponse.json({ error: "Escriba un correo electrónico válido." }, { status: 400 });
  if (correo === cuenta.correo) return NextResponse.json({ error: "Ese ya es el correo de su cuenta." }, { status: 400 });
  try {
    await solicitarCambioCorreo(cuenta.id, correo, ip);
  } catch (err) {
    console.error("No se pudo generar el código de cambio de correo:", err);
  }
  return NextResponse.json({ mensaje: MENSAJE });
}
