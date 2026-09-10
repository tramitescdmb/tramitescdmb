import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeVerNivelAccesoExpediente } from "@/lib/permisos";
import { descargarDocumento } from "@/lib/storage";
import { generarExpedientePdf, type PiezaExpediente } from "@/lib/pdf-expediente";
import { ordenarDocumentosExpediente } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";

const ETIQUETA_PIEZA: Record<string, string> = {
  ENVIADA: "Oficio de salida",
  RECIBIDA: "Comunicación recibida",
  INTERNA: "Memorando interno",
};
const DESCARGABLE = new Set(["application/pdf", "image/png", "image/jpeg"]);

/** Expediente consolidado en un solo PDF (portada + índice + cada documento foliado). El original de cada
 * archivo no se toca — es una vista armada al vuelo, como el «con rótulo» de un adjunto. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) return NextResponse.json({ error: "Sin acceso." }, { status: 403 });

  const exp = await db.expedienteDocumental.findUnique({
    where: { id },
    include: {
      dependencia: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true, criterioOrdenExpediente: true } },
      subserie: { select: { codigo: true, nombre: true } },
      documentos: {
        where: { retiradoEn: null },
        include: { tipoDocumental: { select: { nombre: true } } },
      },
      comunicaciones: {
        orderBy: { fechaRadicacion: "asc" },
        select: {
          id: true, radicado: true, tipo: true, asunto: true, contenido: true, folios: true, fechaRadicacion: true,
          documentos: { orderBy: { createdAt: "asc" }, select: { nombre: true, mimeType: true, storagePath: true, esRespuesta: true } },
          firmas: {
            orderBy: { fechaHora: "asc" },
            select: {
              fechaHora: true, hashContenido: true,
              usuario: { select: { nombre: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, dependencia: { select: { nombre: true } } } },
            },
          },
        },
      },
    },
  });
  if (!exp) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (!puedeVerNivelAccesoExpediente(permisos, exp)) {
    return NextResponse.json({ error: `Sin acceso: ${exp.numero} está clasificado como ${ETIQUETA_NIVEL_ACCESO[exp.nivelAcceso] ?? exp.nivelAcceso}.` }, { status: 403 });
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  const bajar = async (storagePath: string, mimeType: string) => {
    if (!DESCARGABLE.has(mimeType)) return null;
    try {
      return await descargarDocumento(storagePath);
    } catch {
      return null;
    }
  };

  // Enviadas (respuestas) primero, luego recibidas, luego memorandos.
  const orden = { ENVIADA: 0, RECIBIDA: 1, INTERNA: 2 } as const;
  const comunicaciones = exp.comunicaciones.slice().sort((a, b) => {
    const d = (orden[a.tipo as keyof typeof orden] ?? 3) - (orden[b.tipo as keyof typeof orden] ?? 3);
    return d !== 0 ? d : b.fechaRadicacion.getTime() - a.fechaRadicacion.getTime();
  });

  const piezas: PiezaExpediente[] = [];

  for (const c of comunicaciones) {
    const adjuntos = await Promise.all(
      c.documentos.map(async (doc) => ({
        nombre: doc.nombre,
        mimeType: doc.mimeType,
        bytes: await bajar(doc.storagePath, doc.mimeType),
      })),
    );
    piezas.push({
      clase: c.tipo as PiezaExpediente["clase"],
      titulo: `${c.radicado} · ${ETIQUETA_PIEZA[c.tipo] ?? c.tipo}`,
      subtitulo: c.asunto,
      fecha: formatearFechaHoraLarga(c.fechaRadicacion),
      radicado: c.radicado,
      contenido: c.contenido,
      folios: c.folios,
      firmas: c.firmas.map((f) => ({
        nombre: f.usuario.nombre,
        denominacionEmpleo: f.usuario.denominacionEmpleo,
        denominacionComplemento: f.usuario.denominacionComplemento,
        sexo: f.usuario.sexo,
        dependencia: f.usuario.dependencia?.nombre ?? null,
        fechaHora: formatearFechaHoraLarga(f.fechaHora),
        hash: f.hashContenido,
      })),
      adjuntos,
    });
  }

  const criterio = exp.serie?.criterioOrdenExpediente ?? "FECHA_DOCUMENTO";
  for (const doc of ordenarDocumentosExpediente(exp.documentos, criterio)) {
    piezas.push({
      clase: "DOCUMENTO",
      titulo: `Documento ${String(doc.ordenIndice).padStart(3, "0")} · ${doc.nombre}`,
      subtitulo: doc.tipoDocumental?.nombre ?? null,
      fecha: doc.fechaDocumento ? formatearFechaHoraLarga(doc.fechaDocumento) : formatearFechaHoraLarga(doc.createdAt),
      folios: doc.numeroFolios,
      adjuntos: [{ nombre: doc.nombre, mimeType: doc.mimeType, bytes: await bajar(doc.storagePath, doc.mimeType) }],
    });
  }

  if (piezas.length === 0) {
    return NextResponse.json({ error: "El expediente no tiene documentos ni comunicaciones para consolidar." }, { status: 400 });
  }

  const totalFolios =
    exp.documentos.reduce((s, d) => s + (d.numeroFolios || 1), 0) +
    exp.comunicaciones.reduce((s, c) => s + (c.folios || 1), 0);

  let salida: Uint8Array;
  try {
    salida = await generarExpedientePdf(
      {
        numero: exp.numero,
        asunto: exp.asunto,
        dependencia: exp.dependencia.nombre,
        serie: exp.serie ? `${exp.serie.codigo} — ${exp.serie.nombre}` : null,
        subserie: exp.subserie ? `${exp.subserie.codigo} — ${exp.subserie.nombre}` : null,
        estado: exp.estado === "CERRADO" ? "Cerrado" : "Abierto",
        fechaApertura: formatearFechaHoraLarga(exp.fechaApertura),
        fechaCierre: exp.fechaCierre ? formatearFechaHoraLarga(exp.fechaCierre) : null,
        indiceHash: exp.indiceHash,
        totalFolios,
        baseUrl: base,
      },
      piezas,
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo generar el PDF consolidado." }, { status: 500 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Descargó ${exp.numero} como PDF consolidado (${piezas.length} documento(s))`,
  }).catch((e) => console.error("registrarAuditoriaDoc (consolidado) falló:", e));

  return new NextResponse(Buffer.from(salida), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${exp.numero}-consolidado.pdf"`,
    },
  });
}
