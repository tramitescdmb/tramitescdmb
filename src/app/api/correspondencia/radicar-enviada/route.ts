import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { radicarEnviada, type EntradaDocumento } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import type { MedioComunicacion, TipoSolicitante } from "@prisma/client";

const MEDIOS: MedioComunicacion[] = ["FISICO", "CORREO_ELECTRONICO", "WEB", "FAX", "PRESENCIAL", "TELEFONICO", "OTRO"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para radicar en la ventanilla." }, { status: 403 });
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
  const destinatarioNombre = String(body.destinatarioNombre ?? "").trim();
  const destinatarioTipo = (body.destinatarioTipo === "JURIDICA" ? "JURIDICA" : "NATURAL") as TipoSolicitante;
  const medioRaw = String(body.medio ?? "");
  const medio = (MEDIOS as string[]).includes(medioRaw) ? (medioRaw as MedioComunicacion) : null;

  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!contenido) return NextResponse.json({ error: "El contenido del oficio es obligatorio (se firma junto con el radicado)." }, { status: 400 });
  if (!destinatarioNombre) return NextResponse.json({ error: "El nombre/razón social del destinatario es obligatorio." }, { status: 400 });

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
    const comunicacion = await radicarEnviada({
      asunto,
      contenido,
      folios,
      anexosDescripcion: body.anexosDescripcion ? String(body.anexosDescripcion).trim() : null,
      medio,
      destinatario: {
        tipo: destinatarioTipo,
        tipoIdentificacion: body.destinatarioTipoIdentificacion ? String(body.destinatarioTipoIdentificacion).trim() : null,
        identificacion: body.destinatarioIdentificacion ? String(body.destinatarioIdentificacion).trim() : null,
        nombre: destinatarioNombre,
        email: body.destinatarioEmail ? String(body.destinatarioEmail).trim() : null,
        telefono: body.destinatarioTelefono ? String(body.destinatarioTelefono).trim() : null,
        direccion: body.destinatarioDireccion ? String(body.destinatarioDireccion).trim() : null,
        municipio: body.destinatarioMunicipio ? String(body.destinatarioMunicipio).trim() : null,
      },
      dependenciaOrigenId: body.dependenciaOrigenId ? String(body.dependenciaOrigenId) : null,
      serieId: body.serieId ? String(body.serieId) : null,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      respondeAId: body.respondeAId ? String(body.respondeAId) : null,
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
      detalle: `Radicó y firmó ${comunicacion.radicado} (enviada) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ id: comunicacion.id, radicado: comunicacion.radicado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo radicar la comunicación." }, { status: 500 });
  }
}
