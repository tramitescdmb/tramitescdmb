import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { construirWhereExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

const LIMITE_MAXIMO = 5000;

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

const fecha = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Inventario Único Documental (FUID, AGN Acuerdo 042/2002 Anexo 3) de los expedientes documentales —
 * adaptado a un archivo 100% electrónico: "Soporte" siempre Electrónico, sin caja/carpeta/tomo físicos.
 * "Folios" suma el número de folios que declaró quien subió cada documento (MoReq 1.19/1.51) — dato real
 * declarado, no un conteo automático de páginas de PDF (no hay esa librería en el proyecto); documentos
 * cargados antes de que existiera este campo cuentan como 1 folio por defecto.
 * "Frecuencia de consulta" es un dato real, no un relleno: cuenta las veces que AuditoriaDoc registró un
 * LEE sobre ese expediente (se consulta en el propio detalle cada vez que alguien lo abre).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a correspondencia." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || undefined;
  const estadoRaw = sp.get("estado");
  const estado = estadoRaw === "ABIERTO" || estadoRaw === "CERRADO" ? estadoRaw : undefined;
  const dependenciaId = sp.get("dependenciaId") || undefined;
  const serieId = sp.get("serieId") || undefined;

  // Mismo where que el listado (incluida la restricción por nivel de acceso, Ley 1712/2014):
  // un expediente clasificada/reservada tampoco debe poder exportarse por quien no puede verlo.
  const where = construirWhereExpedienteDocumental({ q, estado, dependenciaId, serieId }, permisos);

  const expedientes = await db.expedienteDocumental.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LIMITE_MAXIMO,
    include: {
      dependencia: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      _count: { select: { documentos: true } },
      documentos: { select: { numeroFolios: true } },
    },
  });

  const consultas = await db.auditoriaDoc.groupBy({
    by: ["entidadId"],
    where: { entidad: "ExpedienteDocumental", accion: "LEE", entidadId: { in: expedientes.map((e) => e.id) } },
    _count: { _all: true },
  });
  const consultasPorId = new Map(consultas.map((c) => [c.entidadId, c._count._all]));

  const encabezados = [
    "No.",
    "Dependencia",
    "Serie",
    "Subserie",
    "Expediente",
    "Asunto",
    "Fecha de apertura",
    "Fecha de cierre",
    "Estado",
    "Documentos",
    "Folios",
    "Soporte",
    "Frecuencia de consulta",
    "Nivel de acceso",
  ];

  const filasCsv = expedientes.map((e, i) =>
    [
      i + 1,
      e.dependencia.nombre,
      e.serie ? `${e.serie.codigo} — ${e.serie.nombre}` : "Sin clasificar",
      e.subserie ? `${e.subserie.codigo} — ${e.subserie.nombre}` : "",
      e.numero,
      e.asunto,
      fecha(e.fechaApertura),
      e.fechaCierre ? fecha(e.fechaCierre) : "En trámite",
      e.estado === "ABIERTO" ? "Abierto" : "Cerrado",
      e._count.documentos,
      e.documentos.reduce((acc, d) => acc + d.numeroFolios, 0),
      "Electrónico",
      consultasPorId.get(e.id) ?? 0,
      e.nivelAcceso,
    ]
      .map(celda)
      .join(";")
  );

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: "listado",
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó el FUID de ${expedientes.length} expediente(s) a CSV`,
  });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fuid-expedientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
