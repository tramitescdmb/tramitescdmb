import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";
import { origenPermitido } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { TAMANO_MAXIMO_BYTES, TAMANO_MAXIMO_PLANO_MB, esRequisitoPlano, extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";

/**
 * Permiso de subida de un documento corregido. Solo para un ítem de la devolución pendiente de un
 * expediente de la cuenta en sesión; el archivo va a la carpeta del expediente en el NAS.
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta?.completa) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:correccion-subir", { porHora: 60, porDia: 150 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
  if (!itemId || !fileName) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const item = await db.itemCorreccion.findFirst({
    where: { id: itemId, reemplazoId: null, requerimiento: { estado: "PENDIENTE", expediente: { cuentaCiudadanaId: cuenta.id } } },
    select: { titulo: true, requisito: { select: { nombre: true } }, requerimiento: { select: { expedienteId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Este documento ya no está pendiente. Recargue la página." }, { status: 404 });

  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }
  const topeMb = esRequisitoPlano(item.requisito?.nombre ?? item.titulo) ? TAMANO_MAXIMO_PLANO_MB : TAMANO_MAXIMO_BYTES / (1024 * 1024);
  const path = buildStoragePath(item.requerimiento.expedienteId, fileName);
  const { token } = await crearUrlSubidaFirmada(path, topeMb);
  return NextResponse.json({ path, token, topeMb });
}
