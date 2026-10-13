import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeRegistrarModificacionContrato, puedeSubirEnCualquierEtapaContrato } from "@/lib/permisos";
import { registrarModificacionContrato } from "@/lib/contratacion";
import { leerModificacion } from "@/lib/modificaciones-contrato";
import { TAMANO_MAXIMO_CONTRATACION_BYTES } from "@/lib/uploads-config";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const [permisos, expediente] = await Promise.all([
    obtenerPermisosUsuario(session.userId),
    db.expedienteContractual.findFirst({ where: { id, eliminado: false }, select: { id: true, contratistaId: true, cerrado: true } }),
  ]);
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (!puedeRegistrarModificacionContrato(permisos, expediente)) {
    return NextResponse.json({ error: "No tiene permiso para registrar modificaciones en este contrato." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const modificacion = leerModificacion(body?.modificacion);
  if (!modificacion) return NextResponse.json({ error: "Seleccione el tipo de modificación." }, { status: 400 });
  const archivo = body?.archivo;
  const storagePath = typeof archivo?.storagePath === "string" ? archivo.storagePath : "";
  const mimeType = typeof archivo?.mimeType === "string" ? archivo.mimeType : "";
  const tamanoBytes = Number(archivo?.tamanoBytes) || 0;
  if (!storagePath || !mimeType) return NextResponse.json({ error: "Cargue el acta de la modificación." }, { status: 400 });
  if (tamanoBytes > TAMANO_MAXIMO_CONTRATACION_BYTES) return NextResponse.json({ error: "El archivo supera el tamaño permitido." }, { status: 400 });

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    const resultado = await registrarModificacionContrato({
      expedienteId: id,
      modificacion,
      archivo: { storagePath, mimeType, tamanoBytes, hashSha256: typeof archivo?.hashSha256 === "string" ? archivo.hashSha256 : null },
      requiereFirma: body?.requiereFirma === true,
      usuarioId: session.userId,
      ip,
      userAgent,
      cualquierEtapa: puedeSubirEnCualquierEtapaContrato(permisos),
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar la modificación." }, { status: 400 });
  }
}
