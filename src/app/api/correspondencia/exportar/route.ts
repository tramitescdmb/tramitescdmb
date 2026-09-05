import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { construirWhereCorrespondencia, type FiltrosCorrespondencia } from "@/lib/correspondencia-data";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

const LIMITE_MAXIMO = 5000;

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el listado de correspondencia recibida (mismos filtros de pantalla) a CSV. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a correspondencia." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const filtros: FiltrosCorrespondencia = {
    q: sp.get("q") ?? undefined,
    estado: sp.get("estado") ?? undefined,
    dependencia: sp.get("dependencia") ?? undefined,
  };
  const filtrosPeriodo: FiltrosPeriodo = { desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined };
  const { rango } = resolverPeriodo(filtrosPeriodo);
  const limiteParam = sp.get("limite");
  const take = limiteParam === "todos" || !limiteParam ? LIMITE_MAXIMO : Math.min(Number(limiteParam) || 50, LIMITE_MAXIMO);

  const where = construirWhereCorrespondencia(filtros, rango);
  const filas = await db.comunicacion.findMany({
    where,
    orderBy: [{ fechaRadicacion: "desc" }, { radicado: "desc" }],
    take,
    include: { dependenciaDestino: { select: { nombre: true } }, _count: { select: { documentos: true } } },
  });

  const encabezados = [
    "Radicado",
    "Año",
    "Fecha de radicación",
    "Estado",
    "Medio",
    "Remitente",
    "Tipo de ID",
    "Identificación",
    "Asunto",
    "Folios",
    "Dependencia destino",
    "Documentos",
    "Enlace en la app",
  ];

  const filasCsv = filas.map((c) =>
    [
      c.radicado,
      c.anio,
      c.fechaRadicacion.toISOString().slice(0, 10),
      c.estado,
      c.medio ?? "",
      c.terceroNombre,
      c.terceroTipoIdentificacion,
      c.terceroIdentificacion,
      c.asunto,
      c.folios,
      c.dependenciaDestino?.nombre,
      c._count.documentos,
      `/correspondencia/${c.id}`,
    ]
      .map(celda)
      .join(";")
  );

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: "listado",
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó ${filas.length} comunicaciones a CSV`,
  });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="correspondencia-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
