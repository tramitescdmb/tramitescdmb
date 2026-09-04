import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { construirWhereVital, type FiltrosVital } from "@/lib/vital-data";
import { nombreTramiteVital } from "@/lib/vital";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";

const LIMITE_MAXIMO = 5000; // tope de protección si alguien pide "todos" con una base enorme

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el listado de solicitudes de VITAL (con los mismos filtros de la pantalla) a CSV. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "VITAL_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a VITAL." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const filtros: FiltrosVital = {
    q: sp.get("q") ?? undefined,
    tramite: sp.get("tramite") ?? undefined,
    actividad: sp.get("actividad") ?? undefined,
  };
  const filtrosPeriodo: FiltrosPeriodo = { desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined };
  const { rango } = resolverPeriodo(filtrosPeriodo);
  const limiteParam = sp.get("limite");
  const take = limiteParam === "todos" || !limiteParam ? LIMITE_MAXIMO : Math.min(Number(limiteParam) || 50, LIMITE_MAXIMO);

  const where = construirWhereVital(filtros, rango);
  const filas = await db.solicitudVital.findMany({
    where,
    orderBy: [{ fechaRadicacion: { sort: "desc", nulls: "last" } }, { ultimaSincronizacion: "desc" }],
    take,
    include: { _count: { select: { documentos: true } } },
  });

  const encabezados = [
    "ID VITAL",
    "Trámite",
    "Id de trámite (VITAL)",
    "Id trámite autoridad (CDMB)",
    "Solicitante",
    "Identificación",
    "Correo",
    "Fecha de radicación",
    "Última actividad",
    "Cantidad de documentos",
    "Primera sincronización",
    "Última sincronización",
    "Enlace en la app",
  ];

  const filasCsv = filas.map((s) =>
    [
      s.idVital,
      nombreTramiteVital(s.idTramiteVital),
      s.idTramiteVital,
      s.idTramiteAutoridad,
      s.solicitanteNombre,
      s.solicitanteIdentificacion,
      s.solicitanteCorreo,
      s.fechaRadicacion?.toISOString().slice(0, 10),
      s.nombreActividad,
      s._count.documentos,
      s.createdAt.toISOString().slice(0, 10),
      s.ultimaSincronizacion.toISOString().slice(0, 10),
      `/vital/${s.id}`,
    ]
      .map(celda)
      .join(";")
  );

  // Separador ";" (no ",") porque Excel en configuración regional en español
  // usa la coma como separador decimal y espera punto y coma en el CSV.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vital-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
