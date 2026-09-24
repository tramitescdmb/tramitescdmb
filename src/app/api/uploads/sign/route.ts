import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";
import { getConfiguracionSitio } from "@/lib/config-sitio";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const expedienteId = body?.expedienteId ? String(body.expedienteId) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";
  const esExpedienteNuevo = body?.nuevo === true;

  if (!expedienteId || !fileName) {
    return NextResponse.json({ error: "Faltan expedienteId o fileName." }, { status: 400 });
  }

  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(expedienteId)) {
    return NextResponse.json({ error: "El identificador del expediente no es válido." }, { status: 400 });
  }

  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { id: true } });
  if (esExpedienteNuevo) {
    if (expediente) {
      return NextResponse.json({ error: "Ya existe un expediente con ese identificador." }, { status: 409 });
    }
  } else if (!expediente) {
    return NextResponse.json({ error: "El expediente indicado no existe." }, { status: 404 });
  }

  const path = buildStoragePath(expedienteId, fileName);
  const { token } = await crearUrlSubidaFirmada(path);

  return NextResponse.json({ path, token });
}
