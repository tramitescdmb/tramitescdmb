import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { TAMANO_MAXIMO_BYTES, TAMANO_MAXIMO_PLANO_MB, esRequisitoPlano, extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permiso de subida (vista pública «Solicitud ambiental»). El archivo llega a la carpeta de llegada
 * del NAS y, al radicar, se mueve a la del trámite por año y tipo documental. El tope va en el
 * token firmado: 2 MB, o 10 MB si es un requisito de planos del trámite elegido.
 */
export async function POST(req: NextRequest) {
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:upload-sign", { porHora: 60, porDia: 150 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const folder = typeof body?.folder === "string" ? body.folder : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
  const tramiteId = typeof body?.tramiteId === "string" ? body.tramiteId : "";
  const requisitoId = typeof body?.requisitoId === "string" && body.requisitoId ? body.requisitoId : null;
  if (!UUID_RE.test(folder) || !fileName || !tramiteId) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }

  const tramite = await db.tramiteTipo.findFirst({ where: { id: tramiteId, activo: true, flujos: { some: {} } }, select: { id: true } });
  if (!tramite) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  let topeMb = TAMANO_MAXIMO_BYTES / (1024 * 1024);
  if (requisitoId) {
    const requisito = await db.documentoRequeridoDefinicion.findFirst({ where: { id: requisitoId, tramiteTipoId: tramite.id }, select: { nombre: true } });
    if (!requisito) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    if (esRequisitoPlano(requisito.nombre)) topeMb = TAMANO_MAXIMO_PLANO_MB;
  }

  const [tramiteExistente, contrato, documental] = await Promise.all([
    db.expediente.count({ where: { id: folder } }),
    db.expedienteContractual.count({ where: { id: folder } }),
    db.expedienteDocumental.count({ where: { id: folder } }),
  ]);
  if (tramiteExistente + contrato + documental > 0) return NextResponse.json({ error: "Identificador inválido. Recargue la página." }, { status: 409 });

  const path = buildStoragePath(folder, fileName);
  const { token } = await crearUrlSubidaFirmada(path, topeMb);
  return NextResponse.json({ path, token });
}
