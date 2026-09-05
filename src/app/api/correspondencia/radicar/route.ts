import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { radicarRecibida, type EntradaDocumento } from "@/lib/correspondencia";
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
  const folios = Math.max(1, Math.floor(Number(body.folios) || 1));
  const terceroNombre = String((body.terceroNombre ?? "")).trim();
  const terceroTipo = (body.terceroTipo === "JURIDICA" ? "JURIDICA" : "NATURAL") as TipoSolicitante;
  const medioRaw = String(body.medio ?? "");
  const medio = (MEDIOS as string[]).includes(medioRaw) ? (medioRaw as MedioComunicacion) : null;

  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!terceroNombre) return NextResponse.json({ error: "El nombre/razón social del remitente es obligatorio." }, { status: 400 });

  const documentos: EntradaDocumento[] = Array.isArray(body.documentos)
    ? (body.documentos as unknown[]).map((d) => {
        const doc = d as Record<string, unknown>;
        return {
          path: String(doc.path ?? ""),
          nombre: String(doc.nombre ?? "archivo"),
          descripcion: doc.descripcion ? String(doc.descripcion) : null,
          mimeType: String(doc.mimeType ?? "application/octet-stream"),
          tamanoBytes: Math.max(0, Math.floor(Number(doc.tamanoBytes) || 0)),
          hashSha256: doc.hashSha256 ? String(doc.hashSha256) : null,
        };
      }).filter((d) => d.path)
    : [];

  try {
    const comunicacion = await radicarRecibida({
      asunto,
      folios,
      anexosDescripcion: body.anexosDescripcion ? String(body.anexosDescripcion).trim() : null,
      medio,
      tercero: {
        tipo: terceroTipo,
        tipoIdentificacion: body.terceroTipoIdentificacion ? String(body.terceroTipoIdentificacion).trim() : null,
        identificacion: body.terceroIdentificacion ? String(body.terceroIdentificacion).trim() : null,
        nombre: terceroNombre,
        email: body.terceroEmail ? String(body.terceroEmail).trim() : null,
        telefono: body.terceroTelefono ? String(body.terceroTelefono).trim() : null,
        direccion: body.terceroDireccion ? String(body.terceroDireccion).trim() : null,
        municipio: body.terceroMunicipio ? String(body.terceroMunicipio).trim() : null,
      },
      dependenciaDestinoId: body.dependenciaDestinoId ? String(body.dependenciaDestinoId) : null,
      serieId: body.serieId ? String(body.serieId) : null,
      subserieId: body.subserieId ? String(body.subserieId) : null,
      documentos,
      radicadoPorId: session.userId,
    });

    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: comunicacion.id,
      accion: "CREA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Radicó ${comunicacion.radicado} (recibida) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ id: comunicacion.id, radicado: comunicacion.radicado });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo radicar la comunicación." },
      { status: 500 }
    );
  }
}
