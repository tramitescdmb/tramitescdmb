import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos } from "@/lib/memorandos";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";
import { getConfiguracionSitio } from "@/lib/config-sitio";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prepara la subida al NAS de un adjunto de memorando (o de la respuesta proyectada) a una carpeta nueva. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  if (!ctx.acceso) return NextResponse.json({ error: "No tiene acceso al módulo de memorandos." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const folder = body?.folder ? String(body.folder) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";
  if (!UUID_RE.test(folder) || !fileName) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }
  const [tramite, contrato, documental] = await Promise.all([
    db.expediente.count({ where: { id: folder } }),
    db.expedienteContractual.count({ where: { id: folder } }),
    db.expedienteDocumental.count({ where: { id: folder } }),
  ]);
  if (tramite + contrato + documental > 0) return NextResponse.json({ error: "Identificador inválido." }, { status: 409 });

  const path = buildStoragePath(folder, fileName);
  const { token } = await crearUrlSubidaFirmada(path);
  return NextResponse.json({ path, token });
}
