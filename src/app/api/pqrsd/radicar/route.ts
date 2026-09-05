import { NextRequest, NextResponse } from "next/server";
import type { TipoPQRSD, TipoSolicitante } from "@prisma/client";
import { radicarRecibida, type EntradaDocumento } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { verificarLimiteEnvio, llenadoDemasiadoRapido } from "@/lib/anti-abuso";
import { TERMINO_DIAS_HABILES } from "@/lib/pqrsd";

const TIPOS_PQRSD = Object.keys(TERMINO_DIAS_HABILES) as TipoPQRSD[];

/**
 * Ventanilla pública de PQRSD (Fase 3, sin autenticación) — genera un radicado
 * unificado con el resto de correspondencia. Sin CAPTCHA de terceros: se
 * combina límite por IP (verificarLimiteEnvio), honeypot y tiempo mínimo de
 * llenado. Exige identificación + municipio + un medio de contacto porque,
 * a diferencia de la ventanilla interna, esto es lo único que permite luego
 * consultar el estado en /pqrsd/consultar y darle respuesta al ciudadano.
 */
export async function POST(req: NextRequest) {
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "pqrsd:radicar");
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // Honeypot: campo oculto que solo un bot llenaría. Se responde éxito
  // simulado (sin radicar nada) para no revelarle la trampa.
  if (typeof body.sitioWeb === "string" && body.sitioWeb.trim() !== "") {
    return NextResponse.json({ radicado: "CDMB-R-0000-000000" });
  }
  if (typeof body.tsCarga !== "number" || llenadoDemasiadoRapido(body.tsCarga)) {
    return NextResponse.json({ error: "Por favor intente de nuevo." }, { status: 400 });
  }

  const tipoPqrsd = TIPOS_PQRSD.includes(body.tipoPqrsd as TipoPQRSD) ? (body.tipoPqrsd as TipoPQRSD) : null;
  const asunto = String(body.asunto ?? "").trim();
  const contenido = String(body.contenido ?? "").trim();
  const nombre = String(body.terceroNombre ?? "").trim();
  const terceroTipo = (body.terceroTipo === "JURIDICA" ? "JURIDICA" : "NATURAL") as TipoSolicitante;
  const identificacion = String(body.terceroIdentificacion ?? "").trim();
  const municipio = String(body.terceroMunicipio ?? "").trim();
  const email = String(body.terceroEmail ?? "").trim();
  const telefono = String(body.terceroTelefono ?? "").trim();

  if (!tipoPqrsd) {
    return NextResponse.json({ error: "Seleccione el tipo de solicitud (petición, queja, reclamo, sugerencia o denuncia)." }, { status: 400 });
  }
  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!contenido) return NextResponse.json({ error: "Describa su solicitud." }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: "El nombre o razón social es obligatorio." }, { status: 400 });
  if (!identificacion) return NextResponse.json({ error: "La identificación es obligatoria." }, { status: 400 });
  if (!municipio) return NextResponse.json({ error: "El municipio es obligatorio." }, { status: 400 });
  if (!email && !telefono) {
    return NextResponse.json({ error: "Indique al menos un medio de contacto (correo o teléfono) para poder responderle." }, { status: 400 });
  }

  const documentos: EntradaDocumento[] = Array.isArray(body.documentos)
    ? (body.documentos as unknown[])
        .map((d) => {
          const doc = d as Record<string, unknown>;
          return {
            path: String(doc.path ?? ""),
            nombre: String(doc.nombre ?? "archivo"),
            mimeType: String(doc.mimeType ?? "application/octet-stream"),
            tamanoBytes: Math.max(0, Math.floor(Number(doc.tamanoBytes) || 0)),
            hashSha256: doc.hashSha256 ? String(doc.hashSha256) : null,
          };
        })
        .filter((d) => d.path)
        .slice(0, 6)
    : [];

  try {
    const comunicacion = await radicarRecibida({
      asunto,
      contenido,
      folios: 1,
      medio: "WEB",
      origen: "WEB_PQRSD",
      tercero: {
        tipo: terceroTipo,
        tipoIdentificacion: body.terceroTipoIdentificacion ? String(body.terceroTipoIdentificacion).trim() : null,
        identificacion,
        nombre,
        email: email || null,
        telefono: telefono || null,
        municipio,
      },
      tipoPqrsd,
      documentos,
      radicadoPorId: null,
    });

    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: comunicacion.id,
      accion: "CREA",
      usuarioId: null,
      ip,
      userAgent,
      detalle: `Radicó ${comunicacion.radicado} (PQRSD pública, ${tipoPqrsd}) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({ radicado: comunicacion.radicado, fechaVencimiento: comunicacion.fechaVencimiento });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo radicar la solicitud." }, { status: 500 });
  }
}
