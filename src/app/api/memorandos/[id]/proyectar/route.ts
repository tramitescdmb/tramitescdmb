import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos } from "@/lib/memorandos";
import { registrarRespuestaFuncionario, type EntradaDocumento } from "@/lib/correspondencia";
import { rutasDeCarpetaNueva } from "@/lib/rutas-adjuntos";
import { MENSAJE_RUTA_AJENA } from "@/lib/storage";
import { validarLoteDocumentosSGDEA } from "@/lib/uploads-sgdea";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** La persona asignada proyecta la respuesta; quien dirige la oficina la firma y la envía como memorando nuevo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  if (!ctx.acceso) return NextResponse.json({ error: "No tiene acceso al módulo de memorandos." }, { status: 403 });

  const memo = await db.comunicacion.findUnique({
    where: { id },
    select: { tipo: true, radicado: true, distribuciones: { where: { activa: true, usuarioId: session.userId }, select: { id: true } } },
  });
  if (!memo || memo.tipo !== "INTERNA") return NextResponse.json({ error: "El memorando no existe." }, { status: 404 });
  if (memo.distribuciones.length === 0) return NextResponse.json({ error: "Este memorando no está asignado a usted." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const texto = String(body?.texto ?? "");
  const documentos: EntradaDocumento[] = Array.isArray(body?.documentos)
    ? (body!.documentos as Record<string, unknown>[])
        .map((d) => ({
          path: String(d.path ?? ""),
          nombre: String(d.nombre ?? "archivo"),
          descripcion: d.descripcion ? String(d.descripcion) : null,
          mimeType: String(d.mimeType ?? "application/octet-stream"),
          tamanoBytes: Math.max(0, Math.floor(Number(d.tamanoBytes) || 0)),
          hashSha256: d.hashSha256 ? String(d.hashSha256) : null,
        }))
        .filter((d) => d.path)
    : [];
  const errLote = validarLoteDocumentosSGDEA(documentos);
  if (errLote) return NextResponse.json({ error: errLote }, { status: 400 });
  if (!(await rutasDeCarpetaNueva(documentos))) return NextResponse.json({ error: MENSAJE_RUTA_AJENA }, { status: 400 });

  try {
    await registrarRespuestaFuncionario(id, session.userId, texto, documentos);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar la respuesta." }, { status: 400 });
  }
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "RESPONDE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} proyectó la respuesta del memorando ${memo.radicado} (pendiente de firma de quien dirige la oficina)`,
  });
  return NextResponse.json({ ok: true });
}
