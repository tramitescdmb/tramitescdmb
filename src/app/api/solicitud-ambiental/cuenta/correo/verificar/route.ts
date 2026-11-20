import { NextRequest, NextResponse } from "next/server";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { MENSAJE_CODIGO_INVALIDO, normalizarCodigo, origenPermitido } from "@/lib/cuenta-ciudadana";
import { confirmarCambioCorreo, cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";

/** Confirma el código enviado al correo nuevo y lo deja como correo de la cuenta. */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:correo-verificar", { porHora: 20, porDia: 60 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const codigo = normalizarCodigo(body?.codigo);
  if (!codigo) return NextResponse.json({ error: MENSAJE_CODIGO_INVALIDO }, { status: 400 });
  const r = await confirmarCambioCorreo(cuenta.id, codigo);
  if (!r.ok) return NextResponse.json({ error: MENSAJE_CODIGO_INVALIDO }, { status: 400 });
  try {
    await registrarAuditoriaDoc({
      entidad: "CuentaCiudadana",
      entidadId: cuenta.id,
      accion: "MODIFICA",
      usuarioId: null,
      ip,
      userAgent,
      detalle: "El ciudadano cambió el correo de su cuenta (verificado con código al correo nuevo).",
    });
  } catch (err) {
    console.error("No se pudo registrar en auditoría el cambio de correo ciudadano:", err);
  }
  return NextResponse.json({ ok: true, correo: r.nuevo });
}
