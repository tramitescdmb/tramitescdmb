import { NextRequest, NextResponse } from "next/server";
import { rutasDeCarpetaNueva } from "@/lib/rutas-adjuntos";
import { MENSAJE_RUTA_AJENA } from "@/lib/storage";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { memorandoPendienteDe, contextoMemorandos, PLAZOS_RESPUESTA_MEMORANDO, TEXTO_QUIEN_ENVIA } from "@/lib/memorandos";
import { CIUDAD_MEMORANDO, siglaDependencia, type PersonaMemorando } from "@/lib/memorandos-formato";
import { cargoDelFirmante } from "@/lib/jerarquia-firma";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { radicarInterna, type EntradaDocumento } from "@/lib/correspondencia";
import { validarLoteDocumentosSGDEA } from "@/lib/uploads-sgdea";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

const SELECT_PERSONA = {
  id: true,
  nombre: true,
  activo: true,
  dependenciaId: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  denominacionEncargo: true,
  sexo: true,
  rolesContratacion: true,
} as const;

type FilaPersona = { nombre: string; denominacionEmpleo: string | null; denominacionComplemento: string | null; denominacionEncargo: boolean; sexo: string | null; rolesContratacion: string[] };

function persona(u: FilaPersona): PersonaMemorando {
  return { nombre: u.nombre, cargo: cargoDelFirmante(u, "SGDEA") };
}

/** Firma y envía un memorando (radicado + firma electrónica + número de la oficina, en una sola transacción). */
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
  if (!propio.firmante) return NextResponse.json({ error: TEXTO_QUIEN_ENVIA }, { status: 403 });
  const respondeAId = body.respondeAId ? String(body.respondeAId) : null;
  if (respondeAId && !(await memorandoPendienteDe(respondeAId, propio))) {
    return NextResponse.json({ error: "El memorando que intenta responder ya fue respondido o no está dirigido a su oficina." }, { status: 400 });
  }

  const asunto = String(body.asunto ?? "").trim();
  const contenido = String(body.contenido ?? "").trim();
  const folios = Math.max(1, Math.floor(Number(body.folios) || 1));
  const dependenciaOrigenId = propio.origenLibre && body.dependenciaOrigenId ? String(body.dependenciaOrigenId) : propio.dependenciaId;
  if (!dependenciaOrigenId) return NextResponse.json({ error: "Indique la oficina desde la que firma el memorando." }, { status: 400 });
  const dependenciaDestinoId = String(body.dependenciaDestinoId ?? "");
  const usuarioDestinoId = body.usuarioDestinoId ? String(body.usuarioDestinoId) : "";

  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!contenido) return NextResponse.json({ error: "El cuerpo del memorando es obligatorio (se firma junto con el radicado)." }, { status: 400 });
  if (!dependenciaDestinoId) return NextResponse.json({ error: "Indique la dependencia de destino." }, { status: 400 });
  if (dependenciaOrigenId === dependenciaDestinoId) return NextResponse.json({ error: "La dependencia de destino no puede ser la suya." }, { status: 400 });
  if (!usuarioDestinoId) return NextResponse.json({ error: "Indique la persona a quien va dirigido el memorando (PARA)." }, { status: 400 });

  const [origen, remitente, destinatario] = await Promise.all([
    db.dependencia.findFirst({ where: { id: dependenciaOrigenId, activo: true }, select: { nombre: true, codigo: true } }),
    db.usuario.findUnique({ where: { id: session.userId }, select: SELECT_PERSONA }),
    db.usuario.findUnique({ where: { id: usuarioDestinoId }, select: SELECT_PERSONA }),
  ]);
  if (!origen || !remitente) return NextResponse.json({ error: "No se encontró la oficina de origen." }, { status: 400 });
  if (!destinatario || !destinatario.activo) return NextResponse.json({ error: "El destinatario elegido no existe o está inactivo." }, { status: 400 });
  if (destinatario.dependenciaId !== dependenciaDestinoId) {
    return NextResponse.json({ error: "El destinatario debe pertenecer a la dependencia de destino." }, { status: 400 });
  }

  async function colaborador(campo: "proyectoId" | "revisoId"): Promise<PersonaMemorando | null | "error"> {
    const id = body[campo] ? String(body[campo]) : "";
    if (!id || id === session!.userId) return null;
    const u = await db.usuario.findUnique({ where: { id }, select: SELECT_PERSONA });
    if (!u || !u.activo || u.dependenciaId !== dependenciaOrigenId) return "error";
    return persona(u);
  }
  const [proyecto, reviso] = await Promise.all([colaborador("proyectoId"), colaborador("revisoId")]);
  if (proyecto === "error" || reviso === "error") {
    return NextResponse.json({ error: "Quien proyectó o revisó debe ser una persona activa de su dependencia." }, { status: 400 });
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
  if (!(await rutasDeCarpetaNueva(documentos))) return NextResponse.json({ error: MENSAJE_RUTA_AJENA }, { status: 400 });

  const plazo = Number(body.plazoRespuestaDias) || 0;
  const requiereRespuesta = plazo > 0;
  if (requiereRespuesta && !(PLAZOS_RESPUESTA_MEMORANDO as readonly number[]).includes(plazo)) {
    return NextResponse.json({ error: "Plazo de respuesta no válido." }, { status: 400 });
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
      usuarioDestinoId,
      serieId: body.serieId ? String(body.serieId) : null,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      documentos,
      radicadoPorId: session.userId,
      memorando: {
        codigoDependencia: origen.codigo,
        sigla: siglaDependencia(origen.nombre, origen.codigo),
        datos: {
          ciudad: CIUDAD_MEMORANDO,
          para: persona(destinatario),
          de: persona(remitente),
          proyecto,
          reviso,
          oficina: origen.nombre,
        },
      },
    });

    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: comunicacion.id,
      accion: "FIRMA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Firmó y envió el memorando ${comunicacion.radicado}${respondeAId ? " (respuesta a otro memorando)" : ""}${requiereRespuesta ? `, requiere respuesta en ${plazo} días hábiles` : ""} — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ id: comunicacion.id, radicado: comunicacion.radicado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo enviar el memorando." }, { status: 500 });
  }
}
