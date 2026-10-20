import { NextRequest, NextResponse } from "next/server";
import { whereAccesoSgdea } from "@/lib/sgdea-usuarios";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { eligeOrigenLibre, memorandoPendienteDe, contextoMemorandos, PLAZOS_RESPUESTA_MEMORANDO } from "@/lib/memorandos";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { radicarInterna, type EntradaDocumento } from "@/lib/correspondencia";
import { validarLoteDocumentosSGDEA } from "@/lib/uploads-sgdea";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const propio = await contextoMemorandos(session.userId, permisos);
  if (!propio.firmante) {
    return NextResponse.json({ error: "Los memorandos los firman y envían la Dirección, la Secretaría General, las subdirecciones, las jefaturas de oficina, la asesoría de dirección y la revisoría fiscal." }, { status: 403 });
  }
  const respondeAId = body.respondeAId ? String(body.respondeAId) : null;
  if (respondeAId && !(await memorandoPendienteDe(respondeAId, propio))) {
    return NextResponse.json({ error: "El memorando que intenta responder ya fue respondido o no está dirigido a su oficina." }, { status: 400 });
  }

  const asunto = String(body.asunto ?? "").trim();
  const contenido = String(body.contenido ?? "").trim();
  const folios = Math.max(1, Math.floor(Number(body.folios) || 1));
  let dependenciaOrigenId = String(body.dependenciaOrigenId ?? "");
  if (!eligeOrigenLibre(permisos)) {
    if (!propio.dependenciaId) {
      return NextResponse.json({ error: "Su usuario no tiene dependencia asignada: solicítela a un administrador para poder enviar memorandos." }, { status: 400 });
    }
    dependenciaOrigenId = propio.dependenciaId;
  }
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

  const errLote = validarLoteDocumentosSGDEA(documentos);
  if (errLote) return NextResponse.json({ error: errLote }, { status: 400 });

  const usuarioDestinoIdRaw = body.usuarioDestinoId ? String(body.usuarioDestinoId) : null;
  if (usuarioDestinoIdRaw) {
    const destino = await db.usuario.findUnique({
      where: { id: usuarioDestinoIdRaw },
      select: { activo: true, rol: true, rolCorrespondencia: true, dependenciaId: true },
    });
    if (!destino || !destino.activo) {
      return NextResponse.json({ error: "El destinatario elegido no existe o está inactivo." }, { status: 400 });
    }
    if (destino.dependenciaId !== dependenciaDestinoId) {
      return NextResponse.json({ error: "El destinatario debe pertenecer a la dependencia de destino." }, { status: 400 });
    }
    if (!(await db.usuario.count({ where: { id: usuarioDestinoIdRaw, AND: [await whereAccesoSgdea()] } }))) {
      return NextResponse.json({ error: "El destinatario no tiene acceso al módulo de correspondencia." }, { status: 400 });
    }
  }

  const plazo = Number(body.plazoRespuestaDias) || 0;
  const requiereRespuesta = plazo > 0;
  if (requiereRespuesta && !(PLAZOS_RESPUESTA_MEMORANDO as readonly number[]).includes(plazo)) {
    return NextResponse.json({ error: "Plazo de respuesta no válido." }, { status: 400 });
  }
  if (requiereRespuesta && !usuarioDestinoIdRaw) {
    return NextResponse.json({ error: "Si el memorando requiere respuesta, indique la persona responsable de responderlo." }, { status: 400 });
  }

  const fechaLimiteRespuesta = requiereRespuesta ? sumarDiasHabiles(new Date(), plazo, await getCalendarioLaboral()) : null;

  try {
    const comunicacion = await radicarInterna({
      fechaLimiteRespuesta,
      respondeAId,
      asunto,
      contenido,
      folios,
      dependenciaOrigenId,
      dependenciaDestinoId,
      usuarioDestinoId: usuarioDestinoIdRaw,
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
      detalle: `Radicó y firmó ${comunicacion.radicado} (memorando interno${respondeAId ? ", en respuesta a otro memorando" : ""}${requiereRespuesta ? `, requiere respuesta en ${plazo} días hábiles` : ""}) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ id: comunicacion.id, radicado: comunicacion.radicado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo radicar el memorando." }, { status: 500 });
  }
}
