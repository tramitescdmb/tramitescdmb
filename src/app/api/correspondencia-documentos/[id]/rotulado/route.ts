import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { descargarDocumento } from "@/lib/storage";
import { estamparRotulo } from "@/lib/pdf-rotulado";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { formatearFechaHoraLarga } from "@/lib/fecha";

const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibida", ENVIADA: "Enviada", INTERNA: "Memorando" };

/**
 * Descarga de un documento PDF de correspondencia CON el rótulo de radicación
 * estampado (número + código de barras + QR de verificación) y, si la
 * comunicación está firmada, el sello de firma electrónica al pie. El original
 * en Storage no se modifica — esto genera una copia derivada.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a correspondencia." }, { status: 403 });
  }

  const doc = await db.comunicacionDocumento.findUnique({
    where: { id },
    select: {
      storagePath: true,
      nombre: true,
      mimeType: true,
      comunicacionId: true,
      comunicacion: {
        select: {
          radicado: true,
          tipo: true,
          fechaRadicacion: true,
          folios: true,
          dependenciaDestino: { select: { nombre: true } },
          dependenciaOrigen: { select: { nombre: true } },
          serie: { select: { codigo: true } },
          firmas: {
            orderBy: { fechaHora: "asc" },
            select: {
              fechaHora: true,
              hashContenido: true,
              usuario: {
                select: {
                  nombre: true,
                  denominacionEmpleo: true,
                  denominacionComplemento: true,
                  sexo: true,
                  dependencia: { select: { nombre: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "El rótulo solo se puede estampar sobre documentos PDF." }, { status: 400 });
  }

  const c = doc.comunicacion;
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const dependencia = c.tipo === "RECIBIDA" ? c.dependenciaDestino?.nombre : c.dependenciaOrigen?.nombre;

  let salida: Uint8Array;
  try {
    const original = await descargarDocumento(doc.storagePath);
    salida = await estamparRotulo(
      original,
      {
        radicado: c.radicado,
        tipoEtiqueta: ETIQUETA_TIPO[c.tipo] ?? c.tipo,
        fechaRadicacion: formatearFechaHoraLarga(c.fechaRadicacion),
        dependencia: dependencia ?? null,
        folios: c.folios,
        serieCodigo: c.serie?.codigo ?? null,
        baseUrl: base,
      },
      c.firmas.map((f) => ({
        nombre: f.usuario.nombre,
        denominacionEmpleo: f.usuario.denominacionEmpleo,
        denominacionComplemento: f.usuario.denominacionComplemento,
        sexo: f.usuario.sexo,
        dependencia: f.usuario.dependencia?.nombre ?? null,
        fechaHora: formatearFechaHoraLarga(f.fechaHora),
        hash: f.hashContenido,
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF con rótulo." },
      { status: 500 },
    );
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ComunicacionDocumento",
    entidadId: id,
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Descargó "${doc.nombre}" con rótulo de radicación (${c.radicado})`,
  }).catch((e) => console.error("registrarAuditoriaDoc (rotulado) falló:", e));

  const slug = c.radicado.replace(/[^A-Za-z0-9-]/g, "");
  return new NextResponse(Buffer.from(salida), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-rotulado.pdf"`,
    },
  });
}
