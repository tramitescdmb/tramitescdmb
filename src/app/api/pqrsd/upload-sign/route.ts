import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Firma de subida para adjuntos del formulario público de PQRSD (sin sesión).
 * Ruta separada de /api/uploads/sign a propósito: esa exige sesión y no debe
 * abrirse a llamadas anónimas — esta tiene su propio límite por IP.
 */
export async function POST(req: NextRequest) {
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "pqrsd:upload-sign", { porHora: 20, porDia: 60 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const folder = body?.folder ? String(body.folder) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";
  if (!UUID_RE.test(folder) || !fileName) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!extensionPermitida(fileName)) {
    return NextResponse.json({ error: mensajeTipoNoPermitido(fileName) }, { status: 400 });
  }

  const existente = await db.expediente.findUnique({ where: { id: folder }, select: { id: true } });
  if (existente) return NextResponse.json({ error: "Identificador inválido." }, { status: 409 });

  const path = buildStoragePath(folder, fileName);
  const { token } = await crearUrlSubidaFirmada(path);
  return NextResponse.json({ path, token });
}
