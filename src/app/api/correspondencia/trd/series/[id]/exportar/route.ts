import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibida", ENVIADA: "Enviada", INTERNA: "Memorando" };

/**
 * Exporta TODO lo clasificado bajo una serie (sus comunicaciones y expedientes documentales, de cualquiera
 * de sus subseries) — MoReq 1.12: "exportar el directorio completo de una serie y su contenido". Es
 * distinto del export de la TRD (que exporta la ESTRUCTURA serie/subserie); esto exporta el CONTENIDO
 * clasificado dentro de una serie puntual.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para administrar el archivo." }, { status: 403 });
  }

  const serie = await db.serieDocumental.findUnique({ where: { id }, select: { codigo: true, nombre: true, dependencia: { select: { nombre: true } } } });
  if (!serie) return NextResponse.json({ error: "La serie no existe." }, { status: 404 });

  const [comunicaciones, expedientes] = await Promise.all([
    db.comunicacion.findMany({
      where: { serieId: id },
      orderBy: { fechaRadicacion: "asc" },
      select: {
        radicado: true, tipo: true, asunto: true, estado: true, fechaRadicacion: true,
        subserie: { select: { codigo: true, nombre: true } },
        dependenciaOrigen: { select: { nombre: true } },
        dependenciaDestino: { select: { nombre: true } },
      },
    }),
    db.expedienteDocumental.findMany({
      where: { serieId: id },
      orderBy: { fechaApertura: "asc" },
      select: {
        numero: true, asunto: true, estado: true, fechaApertura: true,
        subserie: { select: { codigo: true, nombre: true } },
        dependencia: { select: { nombre: true } },
      },
    }),
  ]);

  const encabezados = ["Tipo", "Radicado/Número", "Asunto", "Dependencia", "Subserie", "Estado", "Fecha"];
  const filas: string[] = [];
  for (const c of comunicaciones) {
    filas.push([
      ETIQUETA_TIPO[c.tipo] ?? c.tipo,
      c.radicado,
      c.asunto,
      c.dependenciaDestino?.nombre ?? c.dependenciaOrigen?.nombre ?? "",
      c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : "",
      c.estado,
      c.fechaRadicacion.toISOString().slice(0, 10),
    ].map(celda).join(";"));
  }
  for (const e of expedientes) {
    filas.push([
      "Expediente documental",
      e.numero,
      e.asunto,
      e.dependencia.nombre,
      e.subserie ? `${e.subserie.codigo} — ${e.subserie.nombre}` : "",
      e.estado,
      e.fechaApertura.toISOString().slice(0, 10),
    ].map(celda).join(";"));
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "SerieDocumental",
    entidadId: id,
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó el contenido completo de la serie ${serie.codigo} — ${serie.nombre} (${comunicaciones.length} comunicaciones, ${expedientes.length} expedientes)`,
  }).catch((err) => { console.error("No se pudo registrar en la bitácora la exportación del contenido de la serie:", err); });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filas].join("\r\n");
  const nombreArchivo = `serie-${serie.codigo}-${new Date().toISOString().slice(0, 10)}.csv`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
