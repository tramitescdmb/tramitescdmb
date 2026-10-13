import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeRegistrarModificacionContrato } from "@/lib/permisos";
import { adjuntarSoportePresupuestalModificacion } from "@/lib/contratacion";
import { TAMANO_MAXIMO_CONTRATACION_BYTES } from "@/lib/uploads-config";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; modificacionId: string }> }) {
  const { id, modificacionId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const [permisos, expediente] = await Promise.all([
    obtenerPermisosUsuario(session.userId),
    db.expedienteContractual.findFirst({ where: { id, eliminado: false }, select: { id: true, contratistaId: true, cerrado: true } }),
  ]);
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (!puedeRegistrarModificacionContrato(permisos, expediente)) {
    return NextResponse.json({ error: "No tiene permiso para cargar soportes presupuestales en este contrato." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const soporte = body?.soporte === "CDP" || body?.soporte === "RP" ? body.soporte : null;
  if (!soporte) return NextResponse.json({ error: "Indique si el soporte es CDP o RP." }, { status: 400 });
  const archivo = body?.archivo;
  const storagePath = typeof archivo?.storagePath === "string" ? archivo.storagePath : "";
  const mimeType = typeof archivo?.mimeType === "string" ? archivo.mimeType : "";
  const tamanoBytes = Number(archivo?.tamanoBytes) || 0;
  if (!storagePath || !mimeType) return NextResponse.json({ error: "Cargue el archivo del soporte." }, { status: 400 });
  if (tamanoBytes > TAMANO_MAXIMO_CONTRATACION_BYTES) return NextResponse.json({ error: "El archivo supera el tamaño permitido." }, { status: 400 });

  const { ip, userAgent } = datosPeticion(req.headers);
  try {
    await adjuntarSoportePresupuestalModificacion({
      expedienteId: id,
      modificacionId,
      soporte,
      archivo: { storagePath, mimeType, tamanoBytes, hashSha256: typeof archivo?.hashSha256 === "string" ? archivo.hashSha256 : null },
      usuarioId: session.userId,
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo cargar el soporte." }, { status: 400 });
  }
}
