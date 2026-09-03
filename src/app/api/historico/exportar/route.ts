import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { construirWhereHistorico, type FiltrosHistorico } from "@/lib/sinca-data";

const LIMITE_MAXIMO = 5000; // tope de protección si alguien pide "todos" con una base enorme

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el listado de SINCA 1.0 (con los mismos filtros de la pantalla) a CSV. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a SINCA 1.0." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const filtros: FiltrosHistorico = {
    q: sp.get("q") ?? undefined,
    anio: sp.get("anio") ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    municipio: sp.get("municipio") ?? undefined,
    estado: sp.get("estado") ?? undefined,
  };
  const limiteParam = sp.get("limite");
  const take = limiteParam === "todos" || !limiteParam ? LIMITE_MAXIMO : Math.min(Number(limiteParam) || 50, LIMITE_MAXIMO);

  const where = construirWhereHistorico(filtros);
  const filas = await db.sincaResolucion.findMany({
    where,
    orderBy: [{ fechaResolucion: { sort: "desc", nulls: "last" } }, { nroSolicitud: "desc" }],
    take,
    select: {
      nroSolicitud: true,
      numeroResolucion: true,
      fechaResolucion: true,
      fechaRecibido: true,
      tipoSolicitud: true,
      tipoSolicitudCodigo: true,
      tipoSolicitudNombre: true,
      indTipoSolicitud: true,
      origen: true,
      estado: true,
      departamento: true,
      municipio: true,
      barrio: true,
      expediente: true,
      proyecto: true,
      correo: true,
      solicitanteNit: true,
      solicitanteNombre: true,
      representanteLegal: true,
      idRepresentante: true,
      diasResolucion: true,
      cantidadDocumentos: true,
      cantidadInteresados: true,
      lat: true,
      lon: true,
    },
  });

  const encabezados = [
    "Nro. solicitud",
    "Nro. resolución",
    "Fecha resolución",
    "Fecha recibido",
    "Tipo de solicitud (texto original)",
    "Código de tipo de solicitud",
    "Tipo de solicitud",
    "Normal / Renovación",
    "Origen",
    "Estado",
    "Departamento",
    "Municipio",
    "Barrio",
    "Expediente",
    "Proyecto",
    "Correo",
    "NIT/Cédula solicitante",
    "Solicitante",
    "Representante legal",
    "NIT/Cédula representante legal",
    "Días de trámite",
    "Cantidad de documentos",
    "Cantidad de interesados",
    "Latitud",
    "Longitud",
    "Enlace en la app",
  ];

  const filasCsv = filas.map((r) =>
    [
      r.nroSolicitud,
      r.numeroResolucion,
      r.fechaResolucion?.toISOString().slice(0, 10),
      r.fechaRecibido?.toISOString().slice(0, 10),
      r.tipoSolicitud,
      r.tipoSolicitudCodigo,
      r.tipoSolicitudNombre,
      r.indTipoSolicitud,
      r.origen,
      r.estado,
      r.departamento,
      r.municipio,
      r.barrio,
      r.expediente,
      r.proyecto,
      r.correo,
      r.solicitanteNit,
      r.solicitanteNombre,
      r.representanteLegal,
      r.idRepresentante,
      r.diasResolucion,
      r.cantidadDocumentos,
      r.cantidadInteresados,
      r.lat,
      r.lon,
      `/historico/solicitudes/${r.nroSolicitud}`,
    ]
      .map(celda)
      .join(",")
  );

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(","), ...filasCsv].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sinca1-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
