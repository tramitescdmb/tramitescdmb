import { NextRequest, NextResponse } from "next/server";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";
import { MENSAJE_CODIGO_INVALIDO, normalizarCodigo, normalizarCorreo, origenPermitido } from "@/lib/cuenta-ciudadana";
import { verificarCodigo } from "@/lib/cuenta-ciudadana-db";

/** Comprueba el código de 6 dígitos y abre la sesión del ciudadano. */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:verificar", { porHora: 20, porDia: 60 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const correo = normalizarCorreo(body?.correo);
  const codigo = normalizarCodigo(body?.codigo);
  if (!correo || !codigo) return NextResponse.json({ error: MENSAJE_CODIGO_INVALIDO }, { status: 400 });

  const ok = await verificarCodigo(correo, codigo, { ip, userAgent });
  if (!ok) return NextResponse.json({ error: MENSAJE_CODIGO_INVALIDO }, { status: 400 });
  return NextResponse.json({ ok: true });
}
