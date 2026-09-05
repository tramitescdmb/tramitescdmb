import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { radicarInterna, type EntradaDocumento } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para radicar memorandos." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const asunto = String(body.asunto ?? "").trim();
  const contenido = String(body.contenido ?? "").trim();
  const folios = Math.max(1, Math.floor(Number(body.folios) || 1));
  const dependenciaOrigenId = String(body.dependenciaOrigenId ?? "");
  const dependenciaDestinoId = String(body.dependenciaDestinoId ?? "");

  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!contenido) return NextResponse.json({ error: "El contenido del memorando es obligatorio (se firma junto con el radicado)." }, { status: 400 });
  if (!dependenciaOrigenId || !dependenciaDestinoId) {
    return NextResponse.json({ error: "Debe indicar la dependencia de origen y la de destino." }, { status: 400 });
  }
  if (dependenciaOrigenId === dependenciaDestinoId) {
    return NextResponse.json({ error: "La dependencia de origen y la de destino no pueden ser la misma." }, { status: 400 });
  }

  const documentos: EntradaDocumento[] = Array.isArray(body.documentos)
    ? (body.documentos as unknown[])
        .map((d) => {
          const doc = d as Record<string, unknown>;
          return {
            path: String(doc.path ?? ""),
            nombre: String(doc.nombre ?? "archivo"),
            descripcion: doc.descripcion ? String(doc.descripcion) : null,
            mimeType: String(doc.mimeType ?? "application/octet-stream"),
            tamanoBytes: Math.max(0, Math.floor(Number(doc.tamanoBytes) || 0)),
            hashSha256: doc.hashSha256 ? String(doc.hashSha256) : null,
          };
        })
        .filter((d) => d.path)
    : [];

  try {
    const comunicacion = await radicarInterna({
      asunto,
      contenido,
      folios,
      dependenciaOrigenId,
      dependenciaDestinoId,
      serieId: body.serieId ? String(body.serieId) : null,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      documentos,
      radicadoPorId: session.userId,
    });

    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: comunicacion.id,
      accion: "FIRMA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Radicó y firmó ${comunicacion.radicado} (memorando interno) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ id: comunicacion.id, radicado: comunicacion.radicado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo radicar el memorando." }, { status: 500 });
  }
}
