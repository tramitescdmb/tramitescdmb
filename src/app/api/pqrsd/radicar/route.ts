import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import type { TipoPQRSD, TipoSolicitante } from "@prisma/client";
import { entradaTerceroDesdePersona, radicarRecibida, type EntradaDocumento } from "@/lib/correspondencia";
import { leerDatosPersona } from "@/lib/datos-persona";
import { validarLoteDocumentosSGDEA, MAX_ARCHIVOS_LOTE } from "@/lib/uploads-sgdea";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { verificarLimiteEnvio, llenadoDemasiadoRapido } from "@/lib/anti-abuso";
import { TERMINO_DIAS_HABILES } from "@/lib/pqrsd";

const TIPOS_PQRSD = Object.keys(TERMINO_DIAS_HABILES) as TipoPQRSD[];

const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generarCodigoSeguimiento() {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

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

  if (typeof body.sitioWeb === "string" && body.sitioWeb.trim() !== "") {
    return NextResponse.json({ radicado: "CDMB-R-0000-000000" });
  }
  if (typeof body.tsCarga !== "number" || llenadoDemasiadoRapido(body.tsCarga)) {
    return NextResponse.json({ error: "Por favor intente de nuevo." }, { status: 400 });
  }

  const anonima = body.anonima === true;
  const tipoPqrsd = TIPOS_PQRSD.includes(body.tipoPqrsd as TipoPQRSD) ? (body.tipoPqrsd as TipoPQRSD) : null;
  const asunto = String(body.asunto ?? "").trim();
  const contenido = String(body.contenido ?? "").trim();
  const tercero = entradaTerceroDesdePersona(leerDatosPersona(body.tercero));

  if (!tipoPqrsd) {
    return NextResponse.json({ error: "Seleccione el tipo de solicitud (petición, queja, reclamo, sugerencia o denuncia)." }, { status: 400 });
  }
  if (!asunto) return NextResponse.json({ error: "El asunto es obligatorio." }, { status: 400 });
  if (!contenido) return NextResponse.json({ error: "Describa su solicitud." }, { status: 400 });

  const codigoSeguimiento = anonima ? generarCodigoSeguimiento() : null;

  if (!anonima) {
    if (!tercero.nombre) return NextResponse.json({ error: "El nombre o razón social es obligatorio." }, { status: 400 });
    if (!tercero.identificacion) return NextResponse.json({ error: "La identificación es obligatoria." }, { status: 400 });
    if (!tercero.municipio || !tercero.departamento) return NextResponse.json({ error: "Indique el departamento y la ciudad." }, { status: 400 });
    if (!tercero.email && !tercero.celular && !tercero.telefono) {
      return NextResponse.json({ error: "Indique al menos un medio de contacto (correo, celular o teléfono) para poder responderle." }, { status: 400 });
    }
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
        .slice(0, MAX_ARCHIVOS_LOTE)
    : [];

  const errLote = validarLoteDocumentosSGDEA(documentos);
  if (errLote) return NextResponse.json({ error: errLote }, { status: 400 });

  try {
    const comunicacion = await radicarRecibida({
      asunto,
      contenido,
      folios: 1,
      medio: "WEB",
      origen: "WEB_PQRSD",
      tercero: anonima
        ? {
            tipo: "NATURAL" as TipoSolicitante,
            tipoIdentificacion: null,
            identificacion: codigoSeguimiento,
            nombre: "Anónimo",
            email: null,
            telefono: null,
            municipio: null,
          }
        : tercero,
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
      detalle: `Radicó ${comunicacion.radicado} (PQRSD pública${anonima ? " anónima" : ""}, ${tipoPqrsd}) — ${asunto.slice(0, 200)}`,
    });

    return NextResponse.json({
      radicado: comunicacion.radicado,
      fechaVencimiento: comunicacion.fechaVencimiento,
      ...(codigoSeguimiento ? { codigoSeguimiento } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo radicar la solicitud." }, { status: 500 });
  }
}
