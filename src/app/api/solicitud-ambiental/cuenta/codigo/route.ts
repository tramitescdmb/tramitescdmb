import { NextRequest, NextResponse } from "next/server";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";
import { MENSAJE_CODIGO_ENVIADO, normalizarCorreo, origenPermitido, retoResuelto } from "@/lib/cuenta-ciudadana";
import { solicitarCodigo } from "@/lib/cuenta-ciudadana-db";

/**
 * Pide el código de ingreso a «Mis solicitudes» (sirve igual para registrarse y para volver a
 * entrar). La respuesta es siempre la misma, exista o no una cuenta con ese correo.
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:codigo", { porHora: 10, porDia: 30 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const correo = normalizarCorreo(body?.correo);
  if (!correo) return NextResponse.json({ error: "Escriba un correo electrónico válido." }, { status: 400 });
  if (!retoResuelto(body?.reto, body?.solucion)) {
    return NextResponse.json({ error: "No pudimos comprobar que la solicitud la hace una persona. Recargue la página e intente de nuevo." }, { status: 400 });
  }
  // Campo trampa lleno: robot. Se le responde igual, sin enviar nada.
  if (typeof body?.sitioWeb === "string" && body.sitioWeb.trim() !== "") return NextResponse.json({ mensaje: MENSAJE_CODIGO_ENVIADO });

  try {
    await solicitarCodigo(correo, ip);
  } catch (err) {
    console.error("No se pudo generar el código de ingreso ciudadano:", err);
  }
  return NextResponse.json({ mensaje: MENSAJE_CODIGO_ENVIADO });
}
